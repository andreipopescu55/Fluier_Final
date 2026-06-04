"""
Seed de date demo realiste pentru prezentare / lucrare / screenshot-uri.

RESET determinist: la fiecare rulare sterge rezervarile si bazele existente si
recreeaza un set canonic curat (useri pastrati/actualizati). Astfel starea demo
e mereu aceeasi, indiferent de ce era inainte.

Rulare (din folderul backend, cu venv activ):
    python seed_demo.py

Conturi demo (toate cu parola Demo1234!):
    super@exemplu.ro     (super_admin)
    admin@exemplu.ro     (venue_admin — detine bazele)
    test@exemplu.ro, ana.client@aurora.ro, mihai.demo@exemplu.ro, ioana.demo@exemplu.ro (clienti)
"""
import random
from datetime import datetime, timedelta, time, timezone
from decimal import Decimal

from app.db.session import SessionLocal
from app.core.security import hash_password
from app.crud import venue_crud
from app.crud.booking import (
    compute_booking_price, create_booking, NoPricingError, BookingConflictError, LOCAL_TZ,
)
from app.models.user import User
from app.models.venue import Venue
from app.models.field import Field, PricingRule
from app.models.booking import Booking
from app.models.enums import (
    UserRole, VenueStatus, SportType, SurfaceType, BookingStatus, BookingSource,
)
from app.schemas.venue import VenueCreate

DEMO_PW = "Demo1234!"
random.seed(42)  # rezultat reproductibil

CLIENTS = [
    ("test@exemplu.ro", "Andrei Popescu", "0722000001"),
    ("ana.client@aurora.ro", "Ana Ionescu", "0722000002"),
    ("mihai.demo@exemplu.ro", "Mihai Georgescu", "0722000003"),
    ("ioana.demo@exemplu.ro", "Ioana Marin", "0722000004"),
]

VENUES = [
    {
        "name": "Complex Sportiv Aurora", "city": "București", "county": "Ilfov",
        "address": "Str. Stadionului 1", "phone": "0212000001",
        "fields": [
            ("Terenul 1", SportType.FOOTBALL_5, SurfaceType.SYNTHETIC_GRASS, False),
            ("Terenul 2", SportType.FOOTBALL_7, SurfaceType.SYNTHETIC_GRASS, False),
        ],
    },
    {
        "name": "Stadionul Cluj Arena", "city": "Cluj-Napoca", "county": "Cluj",
        "address": "Str. Sportului 10", "phone": "0264111222",
        "fields": [
            ("Teren mare", SportType.FOOTBALL_11, SurfaceType.NATURAL_GRASS, False),
        ],
    },
    {
        "name": "Football Park Timișoara", "city": "Timișoara", "county": "Timiș",
        "address": "Bd. Take Ionescu 5", "phone": "0256333444",
        "fields": [
            ("Teren 1", SportType.FOOTBALL_7, SurfaceType.SYNTHETIC_GRASS, False),
        ],
    },
    {
        "name": "Soccer Park Iași", "city": "Iași", "county": "Iași",
        "address": "Calea Chișinăului 22", "phone": "0232555666",
        "fields": [
            ("Teren A", SportType.FOOTBALL_7, SurfaceType.SYNTHETIC_GRASS, False),
            ("Teren B", SportType.FOOTBALL_5, SurfaceType.SYNTHETIC_GRASS, False),
        ],
    },
]


def ensure_user(db, email, name, phone, role):
    u = db.query(User).filter(User.email == email.lower()).first()
    if u is None:
        u = User(email=email.lower(), full_name=name, phone=phone, role=role,
                 password_hash=hash_password(DEMO_PW), email_verified=True)
    else:
        u.password_hash = hash_password(DEMO_PW)
        u.role = role
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def reset_venues(db):
    """Sterge tot ce tine de baze (rezervarile intai, ca sa nu blocheze FK)."""
    db.query(Booking).delete(synchronize_session=False)
    db.commit()
    # DELETE pe venues -> cascade DB pe fields, pricing_rules, subscriptions, venue_facilities
    db.query(Venue).delete(synchronize_session=False)
    db.commit()


def make_pricing(db, field_id):
    """Tarif standard cu acoperire completa 08:00-23:00 (zi/seara + weekend)."""
    rules = []
    for dow in range(0, 5):  # luni-vineri
        rules.append((dow, time(8, 0), time(16, 0), Decimal("80")))
        rules.append((dow, time(16, 0), time(23, 0), Decimal("120")))
    for dow in (5, 6):       # weekend
        rules.append((dow, time(8, 0), time(23, 0), Decimal("100")))
    for dow, s, e, p in rules:
        db.add(PricingRule(field_id=field_id, day_of_week=dow, start_time=s, end_time=e,
                           price_per_hour=p, currency="RON"))
    db.commit()


def seed_bookings(db, fields, clients):
    """Genereaza un set realist de rezervari (trecut + viitor) + blocaje manuale."""
    now = datetime.now(LOCAL_TZ)
    today = now.date()
    used = {}  # (field_id, date) -> [(start_min, end_min)]
    start_options = [9 * 60, 10 * 60 + 30, 17 * 60, 18 * 60 + 30, 20 * 60]
    durations = [60, 90]

    def overlaps(key, s, e):
        return any(not (e <= a or s >= b) for a, b in used.get(key, []))

    created = 0
    target = 26
    attempts = 0
    while created < target and attempts < 3000:
        attempts += 1
        f = random.choice(fields)
        d = today + timedelta(days=random.randint(-10, 12))
        s = random.choice(start_options)
        e = s + random.choice(durations)
        if e > 23 * 60:
            continue
        key = (f.id, d)
        if overlaps(key, s, e):
            continue
        start_dt = datetime(d.year, d.month, d.day, s // 60, s % 60, tzinfo=LOCAL_TZ)
        end_dt = datetime(d.year, d.month, d.day, e // 60, e % 60, tzinfo=LOCAL_TZ)
        try:
            price = compute_booking_price(db, f.id, start_dt, end_dt)
        except NoPricingError:
            continue
        if start_dt < now:
            status = random.choice([BookingStatus.COMPLETED, BookingStatus.COMPLETED,
                                    BookingStatus.CONFIRMED, BookingStatus.CANCELLED])
        else:
            status = random.choice([BookingStatus.CONFIRMED, BookingStatus.CONFIRMED,
                                    BookingStatus.PENDING])
        client = random.choice(clients)
        b = create_booking(
            db, field_id=f.id, user_id=client.id, start_time=start_dt, end_time=end_dt,
            total_price=price, status=status, booking_source=BookingSource.ONLINE,
            customer_name=client.full_name, customer_phone=client.phone,
        )
        if status == BookingStatus.CANCELLED:
            b.cancelled_at = datetime.now(timezone.utc)
            db.add(b)
            db.commit()
        used.setdefault(key, []).append((s, e))
        created += 1

    blocks = 0
    for note in ["Întreținere gazon", "Eveniment privat", "Curățenie programată"]:
        for _ in range(80):
            f = random.choice(fields)
            d = today + timedelta(days=random.randint(1, 12))
            s = random.choice([12 * 60, 16 * 60])
            e = s + 60
            key = (f.id, d)
            if overlaps(key, s, e):
                continue
            start_dt = datetime(d.year, d.month, d.day, s // 60, 0, tzinfo=LOCAL_TZ)
            end_dt = datetime(d.year, d.month, d.day, e // 60, 0, tzinfo=LOCAL_TZ)
            try:
                create_booking(
                    db, field_id=f.id, user_id=None, start_time=start_dt, end_time=end_dt,
                    total_price=Decimal("0.00"), status=BookingStatus.CONFIRMED,
                    booking_source=BookingSource.MANUAL, notes=note,
                )
            except BookingConflictError:
                continue
            used.setdefault(key, []).append((s, e))
            blocks += 1
            break

    return created, blocks


def main():
    db = SessionLocal()
    try:
        admin = ensure_user(db, "admin@exemplu.ro", "Owner Demo", "0700000010", UserRole.VENUE_ADMIN)
        ensure_user(db, "super@exemplu.ro", "Super Admin", "0700000011", UserRole.SUPER_ADMIN)
        clients = [ensure_user(db, em, nm, ph, UserRole.CLIENT) for em, nm, ph in CLIENTS]

        reset_venues(db)

        all_fields = []
        for vc in VENUES:
            v = venue_crud.create(
                db,
                VenueCreate(
                    name=vc["name"], address=vc["address"], city=vc["city"], county=vc["county"],
                    phone=vc["phone"], opening_time=time(8, 0), closing_time=time(23, 0),
                ),
                owner_id=admin.id,
            )
            v.status = VenueStatus.APPROVED
            db.add(v)
            db.commit()
            for (name, sport, surface, indoor) in vc["fields"]:
                f = Field(venue_id=v.id, name=name, sport_type=sport, surface_type=surface,
                          is_indoor=indoor, slot_duration_minutes=30, min_booking_minutes=60,
                          is_active=True)
                db.add(f)
                db.commit()
                db.refresh(f)
                make_pricing(db, f.id)
                all_fields.append(f)

        created, blocks = seed_bookings(db, all_fields, clients)

        print("=== SEED COMPLET (reset) ===")
        print(f"Useri:     {len(clients)} clienti + admin + super (parola: {DEMO_PW})")
        print(f"Baze:      {len(VENUES)} aprobate, {len(all_fields)} terenuri")
        print(f"Rezervari: {created} online + {blocks} blocaje manuale")
    finally:
        db.close()


if __name__ == "__main__":
    main()
