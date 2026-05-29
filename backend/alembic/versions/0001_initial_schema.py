"""initial schema

Migrare initiala — creeaza intreaga schema:
- extensii PostgreSQL (pgcrypto, btree_gist)
- tipuri ENUM
- tabele in ordinea dependintelor FK
- constraint EXCLUDE anti double-booking
- functie + triggere updated_at
- seed pentru facilitati

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


# Helper: declaram tipul ENUM Postgres o singura data si refolosim referinta in coloane.
# create_type=False = nu lasa SQLAlchemy sa-l creeze automat la create_table()
# (le cream noi manual cu CREATE TYPE in upgrade() de mai jos).
def _enum(name: str, *values: str) -> postgresql.ENUM:
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    # ── 1. Extensii PostgreSQL ────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "btree_gist"')

    # ── 2. Tipuri ENUM ────────────────────────────────────────────────────────
    op.execute("CREATE TYPE user_role AS ENUM ('client', 'venue_admin', 'super_admin')")
    op.execute("CREATE TYPE venue_status AS ENUM ('pending', 'approved', 'suspended')")
    op.execute(
        "CREATE TYPE sport_type AS ENUM "
        "('football_5', 'football_7', 'football_11', 'tennis', 'basketball', 'volleyball')"
    )
    op.execute(
        "CREATE TYPE surface_type AS ENUM "
        "('synthetic_grass', 'natural_grass', 'clay', 'hard_court', 'parquet')"
    )
    op.execute(
        "CREATE TYPE booking_status AS ENUM "
        "('pending', 'confirmed', 'cancelled', 'completed', 'no_show')"
    )
    op.execute("CREATE TYPE booking_source AS ENUM ('online', 'manual')")
    op.execute("CREATE TYPE subscription_plan AS ENUM ('basic', 'premium')")
    op.execute(
        "CREATE TYPE subscription_status AS ENUM "
        "('active', 'past_due', 'cancelled', 'incomplete')"
    )
    op.execute(
        "CREATE TYPE payment_status AS ENUM "
        "('succeeded', 'failed', 'refunded', 'pending')"
    )
    op.execute(
        "CREATE TYPE notification_type AS ENUM "
        "('booking_confirmed', 'booking_cancelled', 'booking_reminder')"
    )

    # ── 3. users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("role", _enum("user_role", "client", "venue_admin", "super_admin"),
                  nullable=False, server_default=sa.text("'client'")),
        sa.Column("oauth_provider", sa.String(50), nullable=True),
        sa.Column("oauth_id", sa.String(255), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── 4. venues ─────────────────────────────────────────────────────────────
    op.create_table(
        "venues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(220), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("county", sa.String(100), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("opening_time", sa.Time(), nullable=False),
        sa.Column("closing_time", sa.Time(), nullable=False),
        sa.Column("status", _enum("venue_status", "pending", "approved", "suspended"),
                  nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.UniqueConstraint("slug", name="uq_venues_slug"),
    )
    op.create_index("ix_venues_owner_id", "venues", ["owner_id"])
    op.create_index("ix_venues_slug", "venues", ["slug"], unique=True)
    op.create_index("ix_venues_city", "venues", ["city"])
    op.create_index("ix_venues_status", "venues", ["status"])

    # ── 5. venue_images ───────────────────────────────────────────────────────
    op.create_table(
        "venue_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_cover", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("ix_venue_images_venue_id", "venue_images", ["venue_id"])

    # ── 6. facilities + venue_facilities (many-to-many) ───────────────────────
    op.create_table(
        "facilities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.UniqueConstraint("code", name="uq_facilities_code"),
    )

    op.create_table(
        "venue_facilities",
        sa.Column("venue_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("venues.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("facility_id", sa.Integer(),
                  sa.ForeignKey("facilities.id"), primary_key=True),
    )
    op.create_index("ix_venue_facilities_facility_id", "venue_facilities", ["facility_id"])

    # ── 7. fields ─────────────────────────────────────────────────────────────
    op.create_table(
        "fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("sport_type", _enum("sport_type", "football_5", "football_7",
                                      "football_11", "tennis", "basketball", "volleyball"),
                  nullable=False),
        sa.Column("surface_type", _enum("surface_type", "synthetic_grass", "natural_grass",
                                        "clay", "hard_court", "parquet"), nullable=False),
        sa.Column("is_indoor", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("min_booking_minutes", sa.Integer(), nullable=False,
                  server_default=sa.text("60")),
        sa.Column("slot_duration_minutes", sa.Integer(), nullable=False,
                  server_default=sa.text("30")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.CheckConstraint("min_booking_minutes > 0", name="chk_min_booking_positive"),
        sa.CheckConstraint("slot_duration_minutes > 0", name="chk_slot_duration_positive"),
    )
    op.create_index("ix_fields_venue_id", "fields", ["venue_id"])
    op.create_index("ix_fields_sport_type", "fields", ["sport_type"])
    op.create_index("ix_fields_surface_type", "fields", ["surface_type"])
    op.create_index("ix_fields_is_active", "fields", ["is_active"])

    # ── 8. pricing_rules ──────────────────────────────────────────────────────
    op.create_table(
        "pricing_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("field_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("fields.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("price_per_hour", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default=sa.text("'RON'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.CheckConstraint("day_of_week BETWEEN 0 AND 6", name="chk_day_of_week"),
        sa.CheckConstraint("end_time > start_time", name="chk_time_range"),
        sa.CheckConstraint("price_per_hour > 0", name="chk_price_positive"),
    )
    op.create_index("ix_pricing_rules_field_id", "pricing_rules", ["field_id"])
    op.create_index("ix_pricing_rules_day", "pricing_rules", ["day_of_week"])

    # ── 9. bookings ───────────────────────────────────────────────────────────
    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("field_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("fields.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default=sa.text("'RON'")),
        sa.Column("status", _enum("booking_status", "pending", "confirmed", "cancelled",
                                  "completed", "no_show"),
                  nullable=False, server_default=sa.text("'pending'")),
        sa.Column("booking_source", _enum("booking_source", "online", "manual"),
                  nullable=False, server_default=sa.text("'online'")),
        sa.Column("customer_name", sa.String(150), nullable=True),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancelled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("cancelled_by_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.CheckConstraint("end_time > start_time", name="chk_booking_time"),
        sa.CheckConstraint("total_price >= 0", name="chk_booking_price"),
    )
    op.create_index("ix_bookings_field_id", "bookings", ["field_id"])
    op.create_index("ix_bookings_user_id", "bookings", ["user_id"])
    op.create_index("ix_bookings_status", "bookings", ["status"])
    op.create_index("idx_bookings_time", "bookings", ["field_id", "start_time", "end_time"])

    # Constraint EXCLUDE — anti double-booking la nivel de DB.
    # tstzrange(start, end, '[)') = interval inchis la stanga, deschis la dreapta
    # WITH && = operatorul "se suprapune" pentru range-uri
    # WHERE = aplicat doar pe rezervari active (pending/confirmed)
    # Daca incerci sa inserezi un al doilea rand care se suprapune,
    # PostgreSQL arunca eroare IntegrityError — nu mai e nevoie sa verifici in cod.
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT excl_no_double_booking
        EXCLUDE USING gist (
            field_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        ) WHERE (status IN ('pending', 'confirmed'))
    """)

    # ── 10. subscriptions ─────────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("venues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=False),
        sa.Column("plan", _enum("subscription_plan", "basic", "premium"),
                  nullable=False, server_default=sa.text("'basic'")),
        sa.Column("status", _enum("subscription_status", "active", "past_due",
                                  "cancelled", "incomplete"), nullable=False),
        sa.Column("current_period_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False,
                  server_default=sa.text("false")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.UniqueConstraint("stripe_subscription_id", name="uq_subscriptions_stripe_id"),
    )
    op.create_index("ix_subscriptions_venue_id", "subscriptions", ["venue_id"])
    op.create_index("ix_subscriptions_stripe_id", "subscriptions",
                    ["stripe_subscription_id"], unique=True)
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])

    # ── 11. payments ──────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default=sa.text("'RON'")),
        sa.Column("status", _enum("payment_status", "succeeded", "failed", "refunded", "pending"),
                  nullable=False),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.CheckConstraint("amount >= 0", name="chk_payment_amount"),
        sa.CheckConstraint(
            "(subscription_id IS NOT NULL AND booking_id IS NULL) OR "
            "(subscription_id IS NULL AND booking_id IS NOT NULL)",
            name="chk_payment_target",
        ),
        sa.UniqueConstraint("stripe_payment_intent_id", name="uq_payments_stripe_pi"),
    )
    op.create_index("ix_payments_subscription_id", "payments", ["subscription_id"])
    op.create_index("ix_payments_booking_id", "payments", ["booking_id"])
    op.create_index("ix_payments_status", "payments", ["status"])

    # ── 12. notifications ─────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", _enum("notification_type", "booking_confirmed",
                                "booking_cancelled", "booking_reminder"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("idx_notifications_user_unread", "notifications", ["user_id", "is_read"])
    op.create_index("idx_notifications_created", "notifications", ["created_at"])

    # ── 13. audit_log ─────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("idx_audit_entity", "audit_log", ["entity_type", "entity_id"])
    op.create_index("idx_audit_created", "audit_log", ["created_at"])

    # ── 14. Functie + triggere updated_at ─────────────────────────────────────
    # Triggerul ruleaza inainte de orice UPDATE pe rand si seteaza updated_at = NOW().
    # Avantaj: nu trebuie sa setezi updated_at manual in fiecare UPDATE din cod.
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    for table in ("users", "venues", "fields", "bookings", "subscriptions"):
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        """)

    # ── 15. Seed pentru facilitati ────────────────────────────────────────────
    # ON CONFLICT (code) DO NOTHING = idempotent
    op.execute("""
        INSERT INTO facilities (code, label, icon) VALUES
            ('lighting',         'Nocturna',              'lightbulb'),
            ('showers',          'Dusuri',                'shower'),
            ('parking',          'Parcare',               'parking'),
            ('locker_room',      'Vestiare',              'door-closed'),
            ('bar',              'Bar / Bufet',           'beer'),
            ('equipment_rental', 'Inchiriere echipament', 'box')
        ON CONFLICT (code) DO NOTHING
    """)


def downgrade() -> None:
    # Ordinea inversa fata de upgrade — sterg dependentele inainte.
    for table in ("subscriptions", "bookings", "fields", "venues", "users"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    op.drop_table("audit_log")
    op.drop_table("notifications")
    op.drop_table("payments")
    op.drop_table("subscriptions")

    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS excl_no_double_booking")
    op.drop_table("bookings")
    op.drop_table("pricing_rules")
    op.drop_table("fields")
    op.drop_table("venue_facilities")
    op.drop_table("facilities")
    op.drop_table("venue_images")
    op.drop_table("venues")
    op.drop_table("users")

    for enum_name in (
        "notification_type", "payment_status", "subscription_status", "subscription_plan",
        "booking_source", "booking_status", "surface_type", "sport_type",
        "venue_status", "user_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

    op.execute('DROP EXTENSION IF EXISTS "btree_gist"')
    op.execute('DROP EXTENSION IF EXISTS "pgcrypto"')
