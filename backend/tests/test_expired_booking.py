"""
Testul rezervarii expirate.

Scenariu: un client incepe o rezervare (status=pending, asteapta plata) dar nu
finalizeaza. Slotul ramane blocat. Functia expire_stale_pending_bookings o
anuleaza dupa PENDING_EXPIRY_MINUTES -> slotul redevine liber.

Verificam:
  1. inainte de curatare, slotul e ocupat (a doua rezervare -> conflict);
  2. dupa curatare, rezervarea veche e 'cancelled';
  3. slotul e liber -> o rezervare noua reuseste.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal

import pytest

from app.crud import booking_crud
from app.crud.booking import BookingConflictError, PENDING_EXPIRY_MINUTES
from app.models.booking import Booking
from app.models.enums import BookingStatus, BookingSource


def test_expired_pending_is_cleaned_and_frees_slot(test_field, db):
    field_id = test_field.id
    start = datetime(2026, 7, 2, 18, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=1)

    # Rezervare pending "veche": created_at cu 20 min in urma (peste pragul de 15).
    stale_created = datetime.now(timezone.utc) - timedelta(minutes=PENDING_EXPIRY_MINUTES + 5)
    old = Booking(
        field_id=field_id,
        user_id=None,
        start_time=start,
        end_time=end,
        total_price=Decimal("100.00"),
        status=BookingStatus.PENDING,
        booking_source=BookingSource.ONLINE,
        created_at=stale_created,
    )
    db.add(old)
    db.commit()
    db.refresh(old)
    old_id = old.id

    # 1) Inainte de curatare slotul e ocupat -> a doua rezervare da conflict.
    with pytest.raises(BookingConflictError):
        booking_crud.create_booking(
            db,
            field_id=field_id,
            user_id=None,
            start_time=start,
            end_time=end,
            total_price=Decimal("100.00"),
        )

    # 2) Curatam rezervarile expirate.
    n = booking_crud.expire_stale_pending_bookings(db)
    assert n >= 1, "Trebuie sa fi expirat cel putin o rezervare"

    refreshed = db.get(Booking, old_id)
    assert refreshed.status == BookingStatus.CANCELLED, "Rezervarea veche trebuie anulata"
    assert refreshed.cancelled_at is not None

    # 3) Slotul e liber acum -> o rezervare noua reuseste.
    new = booking_crud.create_booking(
        db,
        field_id=field_id,
        user_id=None,
        start_time=start,
        end_time=end,
        total_price=Decimal("100.00"),
    )
    assert new.status == BookingStatus.PENDING
    assert new.id != old_id


def test_recent_pending_is_not_expired(test_field, db):
    """O rezervare pending recenta NU trebuie atinsa de curatare."""
    field_id = test_field.id
    start = datetime(2026, 7, 3, 18, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=1)

    recent = Booking(
        field_id=field_id,
        user_id=None,
        start_time=start,
        end_time=end,
        total_price=Decimal("100.00"),
        status=BookingStatus.PENDING,
        booking_source=BookingSource.ONLINE,
        # created_at implicit = NOW() (recenta)
    )
    db.add(recent)
    db.commit()
    db.refresh(recent)

    booking_crud.expire_stale_pending_bookings(db)

    db.refresh(recent)
    assert recent.status == BookingStatus.PENDING, "Rezervarea recenta nu trebuie expirata"
