"""
Fixture-uri comune pentru teste.

Strategie: testele ruleaza pe baza de date reala (cea din .env), dar fiecare
test isi creeaza propriile date izolate (user + venue + field cu sufix unic) si
le sterge la final. Asa nu poluam datele de dezvoltare si testele sunt
independente intre ele.
"""
import uuid
from datetime import time

import pytest

from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.venue import Venue
from app.models.field import Field
from app.models.booking import Booking
from app.models.enums import UserRole, VenueStatus, SportType, SurfaceType


@pytest.fixture
def db():
    """O sesiune DB per test, inchisa la final."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_field(db):
    """
    Creeaza un teren de test (cu owner + venue approved) si il returneaza.
    La teardown sterge tot: bookings -> field -> venue -> owner
    (ordinea conteaza din cauza foreign key-urilor ON DELETE RESTRICT).
    """
    suffix = uuid.uuid4().hex[:8]

    owner = User(
        email=f"owner_{suffix}@test.local",
        password_hash=hash_password("test1234"),
        full_name="Test Owner",
        role=UserRole.VENUE_ADMIN,
    )
    db.add(owner)
    db.commit()
    db.refresh(owner)

    venue = Venue(
        owner_id=owner.id,
        name=f"Test Venue {suffix}",
        slug=f"test-venue-{suffix}",
        address="Strada Test 1",
        city="Test City",
        county="Test County",
        opening_time=time(8, 0),
        closing_time=time(23, 0),
        status=VenueStatus.APPROVED,
    )
    db.add(venue)
    db.commit()
    db.refresh(venue)

    field = Field(
        venue_id=venue.id,
        name="Teren Test",
        sport_type=SportType.FOOTBALL_5,
        surface_type=SurfaceType.SYNTHETIC_GRASS,
    )
    db.add(field)
    db.commit()
    db.refresh(field)

    yield field

    # ── Teardown ──────────────────────────────────────────────────────────────
    db.query(Booking).filter(Booking.field_id == field.id).delete(synchronize_session=False)
    db.commit()
    db.delete(field)
    db.commit()
    db.delete(venue)
    db.commit()
    db.delete(owner)
    db.commit()
