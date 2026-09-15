"""drop_prime_grids_orphan

Phase 2 Solution B : suppression physique des grilles devenues orphelines.
Les tables prime_grids / prime_grid_thresholds ne sont plus lues par le moteur
DSM officiel (config.py seule source taux) et ne sont plus exposees via API/UI.
0 ligne en prod au moment de la migration (verifie 2026-09-15).

Revision ID: f1a2b3c4d5e6
Revises: e49ae646c9ad
Create Date: 2026-09-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e49ae646c9ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ordre : enfants d'abord
    op.drop_table('prime_grid_thresholds')
    op.drop_table('prime_grids')


def downgrade() -> None:
    op.create_table('prime_grids',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('partner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('grid_type', sa.Enum('CREATION', 'REVENUE', name='gridtype'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['partner_id'], ['partners.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prime_grids_id'), 'prime_grids', ['id'], unique=False)
    op.create_index(op.f('ix_prime_grids_partner_id'), 'prime_grids', ['partner_id'], unique=False)
    op.create_table('prime_grid_thresholds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grid_id', sa.Integer(), nullable=False),
        sa.Column('min_pct', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('max_pct', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['grid_id'], ['prime_grids.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_prime_grid_thresholds_grid_id'), 'prime_grid_thresholds', ['grid_id'], unique=False)
    op.create_index(op.f('ix_prime_grid_thresholds_id'), 'prime_grid_thresholds', ['id'], unique=False)
