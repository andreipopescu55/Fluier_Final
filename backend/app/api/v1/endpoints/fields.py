"""
Endpoint-uri pentru Field (terenuri) si PricingRule (reguli de pret).
- Fields sunt sub-resursa a unui Venue.
- PricingRules sunt sub-resursa a unui Field.

Ownership transitiv: ca sa modifici un Field, trebuie sa fii owner
pe Venue-ul parinte. Acelasi pentru PricingRule -> Field -> Venue.
"""
import uuid
from datetime import datetime, time, timedelta, date as date_cls

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.crud import venue_crud, field_crud, booking_crud, notification_crud
from app.crud.booking import LOCAL_TZ
from app.models.user import User
from app.models.enums import UserRole, VenueStatus, BookingStatus
from app.models.field import Field, PricingRule
from app.schemas.field import (
    FieldCreate, FieldUpdate, FieldOut,
    PricingRuleCreate, PricingRuleOut,
)


# Doua routere separate ca sa avem prefixe diferite:
# - /venues/{venue_id}/fields → operatii pe colectia de fields a unui venue
# - /fields/{field_id} → operatii pe un field specific (mai scurt URL)
venues_fields_router = APIRouter(prefix="/venues/{venue_id}/fields", tags=["fields"])
fields_router = APIRouter(prefix="/fields", tags=["fields"])
pricing_router = APIRouter(tags=["pricing"])  # rute mixte, fara prefix unic


# ── Helpers ────────────────────────────────────────────────────────────────────
def _ensure_owner_of_venue(venue_id: uuid.UUID, db: Session, current_user: User):
    """Verifica ca userul curent detine venue-ul (sau e super_admin)."""
    venue = venue_crud.get_by_id(db, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue inexistent")
    if venue.owner_id != current_user.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Nu detii acest venue")
    return venue


def _ensure_owner_of_field(field_id: uuid.UUID, db: Session, current_user: User) -> Field:
    """Pentru rutele /fields/{id} — verifica owner via venue parent."""
    field = field_crud.get_field_by_id(db, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field inexistent")
    venue = venue_crud.get_by_id(db, field.venue_id)
    if venue.owner_id != current_user.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Nu detii acest field")
    return field


def _ensure_public_field(field_id: uuid.UUID, db: Session) -> Field:
    """Pentru rute publice — field trebuie sa apartina unui venue approved."""
    field = field_crud.get_field_by_id(db, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field inexistent")
    venue = venue_crud.get_by_id(db, field.venue_id)
    if venue is None or venue.status != VenueStatus.APPROVED:
        raise HTTPException(status_code=404, detail="Field inexistent")
    return field


# ── Fields: rute pe colectie (sub /venues/{venue_id}/fields) ───────────────────
@venues_fields_router.get(
    "",
    response_model=list[FieldOut],
    summary="Lista terenurilor unui venue (public, doar daca venue e approved)",
)
def list_venue_fields(
    venue_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    venue = venue_crud.get_by_id(db, venue_id)
    if venue is None or venue.status != VenueStatus.APPROVED:
        raise HTTPException(status_code=404, detail="Venue inexistent")
    # only_active=True — publicul vede doar terenuri active
    return field_crud.list_fields_by_venue(db, venue_id, only_active=True)


@venues_fields_router.get(
    "/manage",
    response_model=list[FieldOut],
    summary="Lista TUTUROR terenurilor unui venue (owner) — include si inactive",
)
def list_venue_fields_manage(
    venue_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)
    ),
    db: Session = Depends(get_db),
):
    """
    Spre deosebire de ruta publica, returneaza si terenurile inactive si
    functioneaza indiferent de statusul venue-ului (pending/approved/suspended).
    Necesara pentru dashboard-ul de management.
    """
    _ensure_owner_of_venue(venue_id, db, current_user)
    return field_crud.list_fields_by_venue(db, venue_id, only_active=False)


@venues_fields_router.post(
    "",
    response_model=FieldOut,
    status_code=status.HTTP_201_CREATED,
    summary="Adauga un teren nou la un venue",
)
def create_venue_field(
    venue_id: uuid.UUID,
    payload: FieldCreate,
    current_user: User = Depends(
        require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)
    ),
    db: Session = Depends(get_db),
):
    venue = _ensure_owner_of_venue(venue_id, db, current_user)
    field = field_crud.create_field(db, venue_id, payload)

    # Inbox super-admin: un venue_admin a adaugat un teren.
    notification_crud.notify_field_change(
        db, actor=current_user, venue=venue,
        field_name=field.name, action="a adăugat terenul", field_id=field.id,
    )

    return field


# ── Fields: rute pe item (sub /fields/{field_id}) ──────────────────────────────
@fields_router.get(
    "/{field_id}",
    response_model=FieldOut,
    summary="Detaliile unui teren (public)",
)
def get_field(field_id: uuid.UUID, db: Session = Depends(get_db)):
    return _ensure_public_field(field_id, db)


@fields_router.get(
    "/{field_id}/availability",
    summary="Intervale ocupate ale unui teren intr-o zi (public)",
)
def field_availability(
    field_id: uuid.UUID,
    for_date: date_cls = Query(..., alias="date", description="Ziua locala YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Intoarce intervalele OCUPATE (rezervari + blocari, neanulate) pentru ziua data,
    in minute de la miezul noptii local. Frontend-ul marcheaza sloturile ocupate
    inca de la inceput (fara sa fie nevoie de o incercare esuata).
    """
    _ensure_public_field(field_id, db)
    day_start = datetime.combine(for_date, time(0, 0), tzinfo=LOCAL_TZ)
    day_end = day_start + timedelta(days=1)
    bookings = booking_crud.list_bookings_for_field(db, field_id, day_start, day_end)

    occupied = []
    for b in bookings:
        if b.status == BookingStatus.CANCELLED:
            continue
        s = max(b.start_time.astimezone(LOCAL_TZ), day_start)
        e = min(b.end_time.astimezone(LOCAL_TZ), day_end)
        start_min = int((s - day_start).total_seconds() // 60)
        end_min = int((e - day_start).total_seconds() // 60)
        if end_min > start_min:
            occupied.append({"start_min": start_min, "end_min": end_min})
    return {"date": str(for_date), "occupied": occupied}


@fields_router.patch(
    "/{field_id}",
    response_model=FieldOut,
    summary="Actualizeaza un teren (doar owner-ul)",
)
def update_field(
    field_id: uuid.UUID,
    payload: FieldUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    field = _ensure_owner_of_field(field_id, db, current_user)
    field = field_crud.update_field(db, field, payload)

    # Inbox super-admin: un venue_admin a modificat un teren.
    venue = venue_crud.get_by_id(db, field.venue_id)
    notification_crud.notify_field_change(
        db, actor=current_user, venue=venue,
        field_name=field.name, action="a modificat terenul", field_id=field.id,
    )

    return field


@fields_router.delete(
    "/{field_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sterge un teren (cascade pe pricing_rules)",
)
def delete_field(
    field_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    field = _ensure_owner_of_field(field_id, db, current_user)
    # FK-ul booking.field_id e ON DELETE RESTRICT — nu poti sterge un teren cu
    # rezervari (inclusiv istoric). Returnam un mesaj clar in loc de 500.
    if field_crud.has_bookings(db, field_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Terenul are rezervări și nu poate fi șters. Dezactivează-l "
                   "(debifează „Activ”) ca să-l ascunzi clienților.",
        )
    # Datele terenului, retinute inainte de stergere (dupa, obiectul e invalid).
    field_name, venue_id = field.name, field.venue_id
    field_crud.delete_field(db, field)

    # Inbox super-admin: un venue_admin a sters un teren.
    venue = venue_crud.get_by_id(db, venue_id)
    notification_crud.notify_field_change(
        db, actor=current_user, venue=venue,
        field_name=field_name, action="a șters terenul",
    )


# ── PricingRules ───────────────────────────────────────────────────────────────
@pricing_router.get(
    "/fields/{field_id}/pricing",
    response_model=list[PricingRuleOut],
    summary="Regulile de pret ale unui teren (public)",
)
def list_field_pricing(field_id: uuid.UUID, db: Session = Depends(get_db)):
    _ensure_public_field(field_id, db)
    return field_crud.list_pricing_rules(db, field_id)


@pricing_router.get(
    "/fields/{field_id}/pricing/manage",
    response_model=list[PricingRuleOut],
    summary="Regulile de pret ale unui teren (owner) — merge si pe venue neaprobat",
)
def list_field_pricing_manage(
    field_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)
    ),
    db: Session = Depends(get_db),
):
    """Varianta owner a listarii de tarife — pentru management, fara cerinta 'approved'."""
    _ensure_owner_of_field(field_id, db, current_user)
    return field_crud.list_pricing_rules(db, field_id)


@pricing_router.post(
    "/fields/{field_id}/pricing",
    response_model=PricingRuleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Adauga regula de pret pentru un teren",
)
def add_pricing_rule(
    field_id: uuid.UUID,
    payload: PricingRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    field = _ensure_owner_of_field(field_id, db, current_user)

    # Business rule: nu poti avea 2 reguli care se suprapun pe aceeasi zi.
    overlap = field_crud.find_overlapping_rule(
        db,
        field_id=field_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    if overlap is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Exista deja o regula in interval pe ziua {payload.day_of_week}: "
                f"{overlap.start_time}-{overlap.end_time}"
            ),
        )

    rule = field_crud.create_pricing_rule(db, field_id, payload)

    # Inbox super-admin: tarifele fac parte din "modificari la terenuri".
    venue = venue_crud.get_by_id(db, field.venue_id)
    notification_crud.notify_field_change(
        db, actor=current_user, venue=venue,
        field_name=field.name, action="a modificat tarifele terenului", field_id=field.id,
    )

    return rule


@pricing_router.delete(
    "/pricing/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sterge o regula de pret",
)
def delete_pricing_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = field_crud.get_pricing_rule_by_id(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Regula inexistenta")
    # Verifica ownership via field -> venue
    field = _ensure_owner_of_field(rule.field_id, db, current_user)
    field_crud.delete_pricing_rule(db, rule)

    # Inbox super-admin: stergerea unui tarif e tot o modificare la teren.
    venue = venue_crud.get_by_id(db, field.venue_id)
    notification_crud.notify_field_change(
        db, actor=current_user, venue=venue,
        field_name=field.name, action="a modificat tarifele terenului", field_id=field.id,
    )
