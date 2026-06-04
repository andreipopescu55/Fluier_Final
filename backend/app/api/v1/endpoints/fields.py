"""
Endpoint-uri pentru Field (terenuri) si PricingRule (reguli de pret).
- Fields sunt sub-resursa a unui Venue.
- PricingRules sunt sub-resursa a unui Field.

Ownership transitiv: ca sa modifici un Field, trebuie sa fii owner
pe Venue-ul parinte. Acelasi pentru PricingRule -> Field -> Venue.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.crud import venue_crud, field_crud
from app.models.user import User
from app.models.enums import UserRole, VenueStatus
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
    _ensure_owner_of_venue(venue_id, db, current_user)
    return field_crud.create_field(db, venue_id, payload)


# ── Fields: rute pe item (sub /fields/{field_id}) ──────────────────────────────
@fields_router.get(
    "/{field_id}",
    response_model=FieldOut,
    summary="Detaliile unui teren (public)",
)
def get_field(field_id: uuid.UUID, db: Session = Depends(get_db)):
    return _ensure_public_field(field_id, db)


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
    return field_crud.update_field(db, field, payload)


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
    field_crud.delete_field(db, field)


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
    _ensure_owner_of_field(field_id, db, current_user)

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

    return field_crud.create_pricing_rule(db, field_id, payload)


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
    _ensure_owner_of_field(rule.field_id, db, current_user)
    field_crud.delete_pricing_rule(db, rule)
