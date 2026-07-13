"""Extinde enum-ul notification_type cu evenimentele inbox-ului per rol.

Pana acum enum-ul avea doar 3 valori (booking_confirmed/cancelled/reminder),
iar tabela notifications era goala. Pentru inbox adaugam evenimentele:
  - Find Party: cerere de alaturare, aprobare, respingere, iesire, anulare meci;
  - venue admin: rezervare noua / anulata pe terenurile lui;
  - super admin: modificari facute de admini la terenuri.

Revision ID: 0008_notif_types
Revises: 0007_midnight
"""
from alembic import op


revision = "0008_notif_types"
down_revision = "0007_midnight"
branch_labels = None
depends_on = None


NEW_VALUES = (
    "match_join_request",
    "match_request_approved",
    "match_request_rejected",
    "match_player_left",
    "match_cancelled",
    "venue_new_booking",
    "venue_booking_cancelled",
    "admin_field_change",
)


def upgrade() -> None:
    # PostgreSQL 12+ permite ADD VALUE in tranzactie (dar valoarea noua nu poate
    # fi FOLOSITA in aceeasi tranzactie — aici doar o adaugam, nu o folosim).
    for value in NEW_VALUES:
        op.execute(f"ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL nu suporta stergerea valorilor dintr-un enum. Valorile raman,
    # dar sunt inofensive (nu le mai foloseste nimeni dupa downgrade-ul de cod).
    pass
