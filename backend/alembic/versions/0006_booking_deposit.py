"""add bookings.deposit_amount (avans 50%)

Coloana care retine avansul (50% din total) ce trebuie platit cu cardul pentru
confirmare. Restul se achita la baza sportiva. NULL = rezervare fara avans
(ex: blocari manuale admin). Backfill pe rezervarile existente.

Revision ID: 0006_deposit
Revises: 0005_merge
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_deposit"
down_revision = "0005_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=True))
    # Backfill: rezervarile existente cu pret > 0 primesc avans = 50% rotunjit.
    op.execute("UPDATE bookings SET deposit_amount = ROUND(total_price / 2, 2) WHERE total_price > 0")


def downgrade() -> None:
    op.drop_column("bookings", "deposit_amount")
