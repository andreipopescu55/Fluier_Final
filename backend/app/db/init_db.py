from sqlalchemy import text
from app.db.base_class import Base
from app.db.session import engine
import app.models  # noqa: F401 — importul inregistreaza toate modelele in Base.metadata


# ── 1. Extensii PostgreSQL ────────────────────────────────────────────────────
# pgcrypto   → gen_random_uuid() pentru UUID-uri generate in DB
# btree_gist → necesar pentru EXCLUDE constraint pe bookings (anti double-booking)
_EXTENSIONS = [
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
    'CREATE EXTENSION IF NOT EXISTS "btree_gist"',
]

# ── 2. Tipuri ENUM ────────────────────────────────────────────────────────────
# Fiecare DO block e idempotent: daca tipul exista deja, ignora eroarea.
# Modelele au create_type=False, deci SQLAlchemy nu incearca sa le creeze singur.
_ENUM_TYPES = [
    """DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('client', 'venue_admin', 'super_admin');
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE venue_status AS ENUM ('pending', 'approved', 'suspended');
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE sport_type AS ENUM (
            'football_5', 'football_7', 'football_11',
            'tennis', 'basketball', 'volleyball'
        );
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE surface_type AS ENUM (
            'synthetic_grass', 'natural_grass', 'clay', 'hard_court', 'parquet'
        );
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE booking_status AS ENUM (
            'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
        );
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE booking_source AS ENUM ('online', 'manual');
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE subscription_plan AS ENUM ('basic', 'premium');
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE subscription_status AS ENUM (
            'active', 'past_due', 'cancelled', 'incomplete'
        );
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM (
            'succeeded', 'failed', 'refunded', 'pending'
        );
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",

    """DO $$ BEGIN
        CREATE TYPE notification_type AS ENUM (
            'booking_confirmed', 'booking_cancelled', 'booking_reminder'
        );
    EXCEPTION WHEN duplicate_object THEN null; END; $$""",
]

# ── 4. Constraint EXCLUDE anti double-booking ─────────────────────────────────
# tstzrange(start_time, end_time, '[)') = interval inchis la start, deschis la end
# WITH && = operatorul "se suprapune" pentru range-uri
# WHERE = aplicat doar pe rezervarile active (pending/confirmed)
# Efectul: doua rezervari active nu pot ocupa acelasi teren in acelasi interval
_EXCLUDE_CONSTRAINT = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'excl_no_double_booking'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT excl_no_double_booking
        EXCLUDE USING gist (
            field_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        ) WHERE (status IN ('pending', 'confirmed'));
    END IF;
END; $$"""

# ── 5. Triggere updated_at ────────────────────────────────────────────────────
# CREATE OR REPLACE = idempotent, poate rula de mai multe ori fara probleme
# Triggerul seteaza updated_at = NOW() automat la orice UPDATE pe rand
_TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql"""

# Fiecare CREATE TRIGGER e un statement separat
# IF NOT EXISTS — disponibil din PostgreSQL 9.1, evita eroarea daca triggerul exista
_TRIGGERS = [
    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
            CREATE TRIGGER trg_users_updated_at
                BEFORE UPDATE ON users
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END; $$""",

    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_venues_updated_at') THEN
            CREATE TRIGGER trg_venues_updated_at
                BEFORE UPDATE ON venues
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END; $$""",

    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fields_updated_at') THEN
            CREATE TRIGGER trg_fields_updated_at
                BEFORE UPDATE ON fields
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END; $$""",

    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bookings_updated_at') THEN
            CREATE TRIGGER trg_bookings_updated_at
                BEFORE UPDATE ON bookings
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END; $$""",

    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
            CREATE TRIGGER trg_subscriptions_updated_at
                BEFORE UPDATE ON subscriptions
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END; $$""",
]

# ── 6. Date seed pentru facilitati ───────────────────────────────────────────
# ON CONFLICT (code) DO NOTHING = daca inregistrarea exista deja, o sare
# Ruleaza la fiecare pornire, idempotent
_SEED_FACILITIES = """
INSERT INTO facilities (code, label, icon) VALUES
    ('lighting',          'Nocturna',              'lightbulb'),
    ('showers',           'Dusuri',                'shower'),
    ('parking',           'Parcare',               'parking'),
    ('locker_room',       'Vestiare',              'door-closed'),
    ('bar',               'Bar / Bufet',           'beer'),
    ('equipment_rental',  'Inchiriere echipament', 'box')
ON CONFLICT (code) DO NOTHING"""


def init_db() -> None:
    with engine.connect() as conn:
        # Pasul 1: extensii
        for stmt in _EXTENSIONS:
            conn.execute(text(stmt))
        conn.commit()

        # Pasul 2: tipuri ENUM
        for stmt in _ENUM_TYPES:
            conn.execute(text(stmt))
        conn.commit()

    # Pasul 3: creeaza tabelele (CREATE TABLE IF NOT EXISTS pentru fiecare model)
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Pasul 4: constraint EXCLUDE
        conn.execute(text(_EXCLUDE_CONSTRAINT))
        conn.commit()

        # Pasul 5: functia trigger + triggere
        conn.execute(text(_TRIGGER_FUNCTION))
        conn.commit()
        for stmt in _TRIGGERS:
            conn.execute(text(stmt))
        conn.commit()

        # Pasul 6: seed facilitati
        conn.execute(text(_SEED_FACILITIES))
        conn.commit()
