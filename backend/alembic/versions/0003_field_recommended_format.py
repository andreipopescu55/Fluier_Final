"""add fields.recommended_format

Coloana optionala (text liber) pentru recomandarea de format a terenului,
aleasa de admin (ex: "5+1", "6+1"). Pur informativa.

Revision ID: 0003_recformat
Revises: 0002_unaccent
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa


revision = "0003_recformat"
down_revision = "0002_unaccent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("fields", sa.Column("recommended_format", sa.String(length=60), nullable=True))


def downgrade() -> None:
    op.drop_column("fields", "recommended_format")
