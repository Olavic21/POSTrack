"""dsm_primes_system — Grilles de primes, objectifs DSM, etendu DSMCommission.

Revision ID: f7a8b9c0d1e2
Revises: b5c6d7e8f9a0
Create Date: 2026-08-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'f7a8b9c0d1e2'
down_revision = 'b5c6d7e8f9a0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- 1. MicroZone : ajouter potential_coefficient ---
    with op.batch_alter_table('micro_zones') as batch_op:
        batch_op.add_column(
            sa.Column('potential_coefficient', sa.Float(), nullable=False, server_default='1.0')
        )

    # --- 2. Table dsm_objectives ---
    op.create_table(
        'dsm_objectives',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('partner_id', sa.Integer(), sa.ForeignKey('partners.id'), nullable=False, index=True),
        sa.Column('dsm_id', sa.Integer(), sa.ForeignKey('dsm.id'), nullable=False, index=True),
        sa.Column('prime_period_id', sa.Integer(), sa.ForeignKey('prime_periods.id'), nullable=False, index=True),
        sa.Column('month', sa.Date(), nullable=False, index=True),
        sa.Column('creation_objective', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('revenue_objective', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.UniqueConstraint('dsm_id', 'prime_period_id', name='uq_dsm_objective_period'),
    )

    # --- 3. Table prime_grids ---
    op.create_table(
        'prime_grids',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('partner_id', sa.Integer(), sa.ForeignKey('partners.id'), nullable=False, index=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('grid_type', sa.Enum('CREATION', 'REVENUE', name='gridtype'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- 4. Table prime_grid_thresholds ---
    op.create_table(
        'prime_grid_thresholds',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('grid_id', sa.Integer(), sa.ForeignKey('prime_grids.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('min_pct', sa.Numeric(5, 2), nullable=False),
        sa.Column('max_pct', sa.Numeric(5, 2), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- 5. Etendre dsm_commissions ---
    with op.batch_alter_table('dsm_commissions') as batch_op:
        batch_op.add_column(sa.Column('creation_objective', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('creation_realized', sa.Integer(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('creation_achievement_pct', sa.Numeric(5, 2), nullable=True))
        batch_op.add_column(sa.Column('creation_prime_amount', sa.Numeric(12, 2), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('revenue_objective', sa.Numeric(12, 2), nullable=True))
        batch_op.add_column(sa.Column('revenue_realized', sa.Numeric(12, 2), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('revenue_achievement_pct', sa.Numeric(5, 2), nullable=True))
        batch_op.add_column(sa.Column('revenue_prime_amount', sa.Numeric(12, 2), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('total_prime_amount', sa.Numeric(12, 2), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('dsm_name', sa.String(150), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('dsm_commissions') as batch_op:
        batch_op.drop_column('dsm_name')
        batch_op.drop_column('total_prime_amount')
        batch_op.drop_column('revenue_prime_amount')
        batch_op.drop_column('revenue_achievement_pct')
        batch_op.drop_column('revenue_realized')
        batch_op.drop_column('revenue_objective')
        batch_op.drop_column('creation_prime_amount')
        batch_op.drop_column('creation_achievement_pct')
        batch_op.drop_column('creation_realized')
        batch_op.drop_column('creation_objective')

    op.drop_table('prime_grid_thresholds')
    op.drop_table('prime_grids')
    op.drop_table('dsm_objectives')

    with op.batch_alter_table('micro_zones') as batch_op:
        batch_op.drop_column('potential_coefficient')
