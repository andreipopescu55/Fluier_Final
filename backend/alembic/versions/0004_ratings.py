"""add ratings table

Evaluari (1-5 stele + comentariu) ale bazelor sportive de catre utilizatori.
Un singur rating per (user, venue).

Revision ID: 0004_ratings
Revises: 0003_recformat
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_ratings"
down_revision = "0003_recformat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("score BETWEEN 1 AND 5", name="chk_rating_score"),
        sa.UniqueConstraint("venue_id", "user_id", name="uq_rating_user_venue"),
    )
    op.create_index("ix_ratings_venue_id", "ratings", ["venue_id"])
    op.create_index("ix_ratings_user_id", "ratings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ratings_user_id", table_name="ratings")
    op.drop_index("ix_ratings_venue_id", table_name="ratings")
    op.drop_table("ratings")
