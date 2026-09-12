"""merge gps and dsm_primes

Revision ID: 82f6807130e3
Revises: b4d6f8a0c2e4, f7a8b9c0d1e2
Create Date: 2026-09-12 03:42:43.644924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82f6807130e3'
down_revision: Union[str, None] = ('b4d6f8a0c2e4', 'f7a8b9c0d1e2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
