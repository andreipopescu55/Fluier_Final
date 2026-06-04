"""
Testul central al lucrarii: anti double-booking sub CONCURENTA reala.

Pornim 2 fire de executie care incearca SIMULTAN sa rezerve exact acelasi slot
pe acelasi teren. Le aliniem cu un threading.Barrier ca sa loveasca baza de date
in acelasi moment (race condition real).

Asteptare: EXACT unul reuseste, celalalt primeste IntegrityError de la
constraint-ul EXCLUDE 'excl_no_double_booking'. Garantia vine de la PostgreSQL,
nu din cod — deci nu exista fereastra TOCTOU.
"""
import threading
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.enums import BookingStatus, BookingSource


def test_concurrent_double_booking_only_one_succeeds(test_field):
    field_id = test_field.id
    start = datetime(2026, 7, 1, 18, 0, tzinfo=timezone.utc)
    end = start + timedelta(hours=1)

    barrier = threading.Barrier(2)
    results: list[str] = []
    results_lock = threading.Lock()

    def attempt():
        session = SessionLocal()
        try:
            booking = Booking(
                field_id=field_id,
                user_id=None,
                start_time=start,
                end_time=end,
                total_price=Decimal("100.00"),
                status=BookingStatus.PENDING,
                booking_source=BookingSource.ONLINE,
            )
            session.add(booking)
            # Asteptam ambele fire aici, apoi commit-am ~simultan.
            barrier.wait(timeout=10)
            session.commit()
            with results_lock:
                results.append("ok")
        except IntegrityError:
            session.rollback()
            with results_lock:
                results.append("conflict")
        finally:
            session.close()

    t1 = threading.Thread(target=attempt)
    t2 = threading.Thread(target=attempt)
    t1.start()
    t2.start()
    t1.join(timeout=15)
    t2.join(timeout=15)

    # Exact una reusita, exact un conflict.
    assert results.count("ok") == 1, f"Trebuie sa reuseasca exact una: {results}"
    assert results.count("conflict") == 1, f"Trebuie sa esueze exact una: {results}"

    # In baza de date trebuie sa existe O SINGURA rezervare activa pe acel slot.
    check = SessionLocal()
    try:
        active = (
            check.query(Booking)
            .filter(
                Booking.field_id == field_id,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            )
            .count()
        )
        assert active == 1, f"Trebuie sa existe exact 1 rezervare activa, am gasit {active}"
    finally:
        check.close()
