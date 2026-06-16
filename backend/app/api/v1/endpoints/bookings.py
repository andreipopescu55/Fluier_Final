"""
Endpoint-uri pentru Booking (rezervari).

Fluxul clientului:
  POST   /bookings            -> creeaza o rezervare online (status=pending)
  GET    /bookings/me         -> rezervarile mele
  GET    /bookings/{id}       -> o rezervare (owner / admin venue / super_admin)
  POST   /bookings/{id}/cancel-> anuleaza (elibereaza slotul)

Logica anti double-booking sta in crud.booking.create_booking (constraint EXCLUDE).
Aici doar validam inputul si traducem exceptiile de domeniu in coduri HTTP.
"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.crud import venue_crud, field_crud, booking_crud
from app.crud.booking import BookingConflictError, NoPricingError, LOCAL_TZ, ensure_tz
from app.models.user import User
from app.models.field import Field
from app.models.enums import UserRole, VenueStatus, BookingStatus
from app.schemas.booking import BookingCreate, BookingOut


router = APIRouter(prefix="/bookings", tags=["bookings"])


# ── Helpers ─────────────────────────────────────────────────────────────────────
def _get_bookable_field(field_id: uuid.UUID, db: Session) -> Field:
    """Terenul trebuie sa existe, sa fie activ si sub un venue approved."""
    field = field_crud.get_field_by_id(db, field_id)
    if field is None or not field.is_active:
        raise HTTPException(status_code=404, detail="Teren inexistent sau inactiv")
    venue = venue_crud.get_by_id(db, field.venue_id)
    if venue is None or venue.status != VenueStatus.APPROVED:
        raise HTTPException(status_code=404, detail="Teren indisponibil")
    return field


def _validate_same_day(start_local: datetime, end_local: datetime) -> None:
    """O rezervare trebuie sa fie in aceeasi zi calendaristica locala."""
    last_instant = end_local - timedelta(microseconds=1)
    if start_local.date() != last_instant.date():
        raise HTTPException(
            status_code=422,
            detail="Rezervarea trebuie sa inceapa si sa se termine in aceeasi zi",
        )


def _validate_slot(field: Field, start: datetime, end: datetime) -> None:
    """Durata respecta min_booking_minutes si e multiplu de slot_duration_minutes."""
    duration_min = int((end - start).total_seconds() // 60)
    if duration_min < field.min_booking_minutes:
        raise HTTPException(
            status_code=422,
            detail=f"Durata minima a unei rezervari este {field.min_booking_minutes} minute",
        )
    if duration_min % field.slot_duration_minutes != 0:
        raise HTTPException(
            status_code=422,
            detail=f"Durata trebuie sa fie multiplu de {field.slot_duration_minutes} minute",
        )


def _ensure_can_access_booking(booking, db: Session, current_user: User) -> None:
    """Acces permis: super_admin, owner-ul rezervarii, sau admin-ul venue-ului."""
    if current_user.role == UserRole.SUPER_ADMIN:
        return
    if booking.user_id is not None and booking.user_id == current_user.id:
        return
    field = field_crud.get_field_by_id(db, booking.field_id)
    venue = venue_crud.get_by_id(db, field.venue_id) if field else None
    if venue is not None and venue.owner_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Nu ai acces la aceasta rezervare")


# ── Endpoints ────────────────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=BookingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Creeaza o rezervare online",
)
def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    field = _get_bookable_field(payload.field_id, db)

    start = ensure_tz(payload.start_time)
    end = ensure_tz(payload.end_time)

    # Rezervare online -> nu poate fi in trecut.
    if start <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Nu poti rezerva un interval din trecut")

    start_local = start.astimezone(LOCAL_TZ)
    end_local = end.astimezone(LOCAL_TZ)
    _validate_same_day(start_local, end_local)
    _validate_slot(field, start, end)

    # Pretul se calculeaza automat din PricingRules.
    try:
        price = booking_crud.compute_booking_price(db, field.id, start, end)
    except NoPricingError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Interval indisponibil pentru rezervare: {exc}",
        )

    # Insert sigur la concurenta: daca slotul e ocupat -> BookingConflictError.
    try:
        booking = booking_crud.create_booking(
            db,
            field_id=field.id,
            user_id=current_user.id,
            start_time=start,
            end_time=end,
            total_price=price,
            customer_name=payload.customer_name,
            customer_phone=payload.customer_phone,
            notes=payload.notes,
        )
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return booking


@router.get(
    "/me",
    response_model=list[BookingOut],
    summary="Rezervarile mele",
)
def list_my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return booking_crud.list_bookings_by_user(db, current_user.id)


@router.get(
    "/{booking_id}",
    response_model=BookingOut,
    summary="Detaliile unei rezervari",
)
def get_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = booking_crud.get_booking_by_id(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Rezervare inexistenta")
    _ensure_can_access_booking(booking, db, current_user)
    return booking


@router.post(
    "/{booking_id}/pay",
    response_model=BookingOut,
    summary="Plateste avansul (50%) si confirma rezervarea",
)
def pay_deposit(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = booking_crud.get_booking_by_id(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Rezervare inexistenta")
    # Doar proprietarul rezervarii poate plati avansul.
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nu este rezervarea ta")
    if booking.status != BookingStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Rezervarea nu mai e in asteptarea platii (status: {booking.status.value})",
        )
    return booking_crud.pay_deposit(db, booking)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingOut,
    summary="Anuleaza o rezervare (elibereaza slotul)",
)
def cancel_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = booking_crud.get_booking_by_id(db, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Rezervare inexistenta")
    _ensure_can_access_booking(booking, db, current_user)

    if booking.status in (BookingStatus.CANCELLED, BookingStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Rezervarea este deja {booking.status.value}",
        )

    # Politica de 24h se aplica clientului (proprietarul). Adminii/super pot anula
    # oricand (gestionare). Pending neplatit poate fi anulat oricand.
    is_owner = booking.user_id == current_user.id
    if is_owner and not booking_crud.owner_can_cancel(booking):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Anularea nu mai e posibila cu mai putin de {booking_crud.CANCELLATION_CUTOFF_HOURS}h inainte de ora rezervata.",
        )

    return booking_crud.cancel_booking(db, booking, cancelled_by_id=current_user.id)
