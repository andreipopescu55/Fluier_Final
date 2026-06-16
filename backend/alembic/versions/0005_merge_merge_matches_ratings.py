"""merge matches + ratings

Revision ID: 0005_merge
Revises: 0004_matches, 0004_ratings
Create Date: 2026-06-16 20:38:14.057009

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005_merge'
down_revision: Union[str, None] = ('0004_matches', '0004_ratings')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
