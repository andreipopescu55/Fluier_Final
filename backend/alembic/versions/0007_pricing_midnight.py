"""relaxeaza chk_time_range pe pricing_rules (permite end_time = 00:00 = miezul noptii)

Asa o regula de pret poate ajunge pana la miezul noptii (program pana noaptea
tarziu), iar rezervarile pot trece de 00:00 (ex: 23:00-01:00).

Revision ID: 0007_midnight
Revises: 0006_deposit
Create Date: 2026-06-17
"""
from alembic import op


revision = "0007_midnight"
down_revision = "0006_deposit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("chk_time_range", "pricing_rules", type_="check")
    op.create_check_constraint(
        "chk_time_range", "pricing_rules",
        "end_time > start_time OR end_time = '00:00:00'",
    )


def downgrade() -> None:
    op.drop_constraint("chk_time_range", "pricing_rules", type_="check")
    op.create_check_constraint(
        "chk_time_range", "pricing_rules", "end_time > start_time",
    )
