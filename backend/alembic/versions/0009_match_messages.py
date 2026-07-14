"""Chat de meci (Find Party): tabela match_messages.

Conversatia echipei unui meci — mesaje text intre organizator si jucatorii
aprobati. user_id NULL = mesaj de sistem (intrari/iesiri din echipa, meci
complet/anulat), astfel chatul e si cronologia meciului.

Revision ID: 0009_match_messages
Revises: 0008_notif_types
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0009_match_messages"
down_revision = "0008_notif_types"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "match_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("match_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("matches.id", ondelete="CASCADE"), nullable=False),
        # NULL = mesaj de sistem (fara autor uman).
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
    )
    # Interogarea dominanta: mesajele unui meci in ordine cronologica
    # (si polling-ul incremental: match_id + created_at > cursor).
    op.create_index(
        "idx_match_messages_match_created", "match_messages",
        ["match_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_match_messages_match_created", table_name="match_messages")
    op.drop_table("match_messages")
