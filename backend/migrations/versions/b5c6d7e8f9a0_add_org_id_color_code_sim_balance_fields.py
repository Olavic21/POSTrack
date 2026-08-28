"""Ajout champs etendus pour imports reels (STOCK/ZONE ODI).

Revision ID: b5c6d7e8f9a0
Revises: a1b1c3d4e5f6
Create Date: 2026-08-28

Ajoute les champs necessaires a l'import de donnees reels :
- DSM : org_id, color_code, sim_balance
- POS : org_id, color_code, sim_balance
- BTS : coverage_km2, traffic_volume_gb, boundary_points, prominent_site, quarter, street, radius_m
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, None] = "a1b1c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # DSM : org_id, color_code, sim_balance
    with op.batch_alter_table("dsm") as batch_op:
        batch_op.add_column(sa.Column("org_id", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("color_code", sa.String(20), nullable=True))
        batch_op.add_column(sa.Column("sim_balance", sa.Float(), nullable=True))
        batch_op.create_index("ix_dsm_org_id", ["org_id"])

    # POS : org_id, color_code, sim_balance
    with op.batch_alter_table("pos") as batch_op:
        batch_op.add_column(sa.Column("org_id", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("color_code", sa.String(20), nullable=True))
        batch_op.add_column(sa.Column("sim_balance", sa.Float(), nullable=True))
        batch_op.create_index("ix_pos_org_id", ["org_id"])

    # BTS : champs etendus pour zones geographiques
    with op.batch_alter_table("bts") as batch_op:
        batch_op.add_column(sa.Column("coverage_km2", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("traffic_volume_gb", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("boundary_points", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("prominent_site", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("quarter", sa.String(150), nullable=True))
        batch_op.add_column(sa.Column("street", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("radius_m", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("bts") as batch_op:
        batch_op.drop_column("radius_m")
        batch_op.drop_column("street")
        batch_op.drop_column("quarter")
        batch_op.drop_column("prominent_site")
        batch_op.drop_column("boundary_points")
        batch_op.drop_column("traffic_volume_gb")
        batch_op.drop_column("coverage_km2")

    with op.batch_alter_table("pos") as batch_op:
        batch_op.drop_index("ix_pos_org_id")
        batch_op.drop_column("sim_balance")
        batch_op.drop_column("color_code")
        batch_op.drop_column("org_id")

    with op.batch_alter_table("dsm") as batch_op:
        batch_op.drop_index("ix_dsm_org_id")
        batch_op.drop_column("sim_balance")
        batch_op.drop_column("color_code")
        batch_op.drop_column("org_id")
