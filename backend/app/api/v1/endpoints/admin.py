"""
Endpoint-uri pentru zona de administrator (owner de venue / super_admin).

  GET  /admin/fields/{field_id}/calendar?from=&to=  -> evenimente FullCalendar
  POST /admin/fields/{field_id}/block               -> blocheaza manual un interval

Calendarul intoarce rezervarile + blocarile din interval in formatul cerut de
biblioteca FullCalendar (frontend). Blocarea manuala creeaza o rezervare
'manual'/'confirmed' fara user si fara pret — folosita pentru intretinere,
evenimente private sau rezervari telefonice.
"""
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud import venue_crud, field_crud, booking_crud, user_crud
from app.crud.booking import BookingConflictError, ensure_tz, LOCAL_TZ
from app.models.user import User
from app.models.field import Field
from app.models.booking import Booking
from app.models.enums import UserRole, BookingStatus, BookingSource, VenueStatus
from app.schemas.booking import (
    BookingOut, BookingManualBlock, CalendarEvent, CalendarEventProps,
)
from app.schemas.venue import VenueOut, VenueStatusUpdate
from app.schemas.user import UserOut, AdminUserCreate, UserActiveUpdate


router = APIRouter(prefix="/admin", tags=["admin"])


# Culori per status (citite de FullCalendar). Blocarile manuale au culoare proprie.
_STATUS_COLORS = {
    BookingStatus.PENDING: "#f59e0b",    # portocaliu — asteapta confirmare/plata
    BookingStatus.CONFIRMED: "#16a34a",  # verde — confirmata
    BookingStatus.COMPLETED: "#2563eb",  # albastru — incheiata
    BookingStatus.NO_SHOW: "#dc2626",    # rosu — clientul nu s-a prezentat
}
_MANUAL_COLOR = "#6b7280"  # gri — interval blocat de admin


# ── Helpers ─────────────────────────────────────────────────────────────────────
def _ensure_admin_of_field(field_id: uuid.UUID, db: Session, current_user: User) -> Field:
    """Userul curent trebuie sa detina venue-ul parinte (sau sa fie super_admin)."""
    field = field_crud.get_field_by_id(db, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field inexistent")
    venue = venue_crud.get_by_id(db, field.venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue inexistent")
    if venue.owner_id != current_user.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Nu detii acest teren")
    return field


def _to_calendar_event(b: Booking) -> CalendarEvent:
    """Transforma o rezervare in formatul de eveniment FullCalendar."""
    if b.booking_source == BookingSource.MANUAL:
        color = _MANUAL_COLOR
        title = f"Blocat: {b.notes}" if b.notes else "Blocat"
    else:
        color = _STATUS_COLORS.get(b.status, _MANUAL_COLOR)
        title = b.customer_name or "Rezervare online"

    return CalendarEvent(
        id=b.id,
        title=title,
        # Convertim in ora locala -> ISO cu offset (+03:00), ca FullCalendar
        # si demo-ul sa afiseze ora reala din Romania, nu UTC.
        start=b.start_time.astimezone(LOCAL_TZ),
        end=b.end_time.astimezone(LOCAL_TZ),
        color=color,
        extendedProps=CalendarEventProps(
            status=b.status,
            source=b.booking_source,
            total_price=b.total_price,
            currency=b.currency,
            customer_name=b.customer_name,
            customer_phone=b.customer_phone,
            notes=b.notes,
        ),
    )


# ── Calendar ──────────────────────────────────────────────────────────────────────
@router.get(
    "/fields/{field_id}/calendar",
    response_model=list[CalendarEvent],
    summary="Calendarul unui teren (format FullCalendar)",
)
def field_calendar(
    field_id: uuid.UUID,
    from_: datetime | None = Query(None, alias="from", description="Inceput interval (default: azi 00:00)"),
    to: datetime | None = Query(None, description="Sfarsit interval (default: from + 7 zile)"),
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    _ensure_admin_of_field(field_id, db, current_user)

    # Valori implicite prietenoase: saptamana curenta.
    if from_ is None:
        now_local = datetime.now(LOCAL_TZ)
        from_ = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    if to is None:
        to = from_ + timedelta(days=7)

    range_start = ensure_tz(from_)
    range_end = ensure_tz(to)
    if range_end <= range_start:
        raise HTTPException(status_code=422, detail="'to' trebuie sa fie dupa 'from'")

    bookings = booking_crud.list_bookings_for_field(db, field_id, range_start, range_end)
    # Pe calendar nu afisam rezervarile anulate (slotul e liber acum).
    return [
        _to_calendar_event(b)
        for b in bookings
        if b.status != BookingStatus.CANCELLED
    ]


# ── Blocare manuala ───────────────────────────────────────────────────────────────
@router.post(
    "/fields/{field_id}/block",
    response_model=BookingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Blocheaza manual un interval (intretinere, eveniment privat etc.)",
)
def block_field_interval(
    field_id: uuid.UUID,
    payload: BookingManualBlock,
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    _ensure_admin_of_field(field_id, db, current_user)

    start = ensure_tz(payload.start_time)
    end = ensure_tz(payload.end_time)

    # Blocarea trece prin ACELASI mecanism anti-suprapunere: daca intervalul e
    # deja rezervat/blocat, constraint-ul EXCLUDE respinge -> 409.
    # status=confirmed ca sa intre sub clauza WHERE a constraint-ului.
    try:
        booking = booking_crud.create_booking(
            db,
            field_id=field_id,
            user_id=None,
            start_time=start,
            end_time=end,
            total_price=Decimal("0.00"),
            status=BookingStatus.CONFIRMED,
            booking_source=BookingSource.MANUAL,
            notes=payload.notes,
        )
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return booking


# ── Moderare baze (DOAR super_admin) ───────────────────────────────────────────────
@router.get(
    "/venues",
    response_model=list[VenueOut],
    summary="Toate bazele sportive (moderare super_admin)",
)
def list_all_venues(
    status_filter: VenueStatus | None = Query(None, alias="status", description="Filtru optional dupa status"),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    return venue_crud.list_all(db, status=status_filter)


@router.patch(
    "/venues/{venue_id}/status",
    response_model=VenueOut,
    summary="Schimba statusul unei baze: approve / suspend (super_admin)",
)
def set_venue_status(
    venue_id: uuid.UUID,
    payload: VenueStatusUpdate,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    venue = venue_crud.get_by_id(db, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue inexistent")
    return venue_crud.set_status(db, venue, payload.status)


# ── Gestionare administratori (DOAR super_admin) ────────────────────────────────────
@router.get(
    "/users",
    response_model=list[UserOut],
    summary="Lista administratorilor (venue_admin / super_admin)",
)
def list_admins(
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    return user_crud.list_staff(db)


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Creeaza un cont de administrator (super_admin)",
)
def create_admin(
    payload: AdminUserCreate,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Super-adminul creeaza direct un cont cu rol de administrare (email + parola).
    Rolul 'client' nu e permis aici (clientii se inregistreaza singuri).
    """
    if payload.role == UserRole.CLIENT:
        raise HTTPException(
            status_code=422,
            detail="Rolul trebuie sa fie venue_admin sau super_admin",
        )
    if user_crud.get_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=409, detail="Emailul este deja folosit")

    # user_crud.create citeste email/full_name/phone/password din payload; rolul il dam explicit.
    return user_crud.create(db, payload, role=payload.role)


@router.patch(
    "/users/{user_id}/active",
    response_model=UserOut,
    summary="Activeaza / dezactiveaza un cont de administrator (super_admin)",
)
def set_user_active(
    user_id: uuid.UUID,
    payload: UserActiveUpdate,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Dezactivarea (is_active=false) blocheaza autentificarea, fara a sterge contul.
    Protectii: nu te poti dezactiva singur si nu poti dezactiva alt super-admin.
    """
    target = user_crud.get_by_id(db, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizator inexistent")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Nu te poti dezactiva pe tine insuti")
    if target.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Nu poti dezactiva un super-admin")
    return user_crud.set_active(db, target, payload.is_active)
