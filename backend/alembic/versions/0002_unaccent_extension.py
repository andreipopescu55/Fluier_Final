"""enable unaccent extension for diacritic-insensitive search

Permite cautarea fara diacritice: unaccent('Iași') -> 'Iasi', astfel incat
"iasi" sa gaseasca "Iași", "brasov" sa gaseasca "Brașov" etc.

Revision ID: 0002_unaccent
Revises: 0001_initial
Create Date: 2026-06-04
"""
from alembic import op


revision = "0002_unaccent"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS unaccent")
