"""Coordonnees GPS POS en Float (decimales WGS84).

Ajoute pos.latitude / pos.longitude en Float pour stocker de vraies
coordonnees GPS : toute coordonnee saisie (ex. 4.0512) etait tronquee
a l'unite (~110 km d'erreur) lorsqu'elle passait par un Integer.

Note historique : la version initiale de cette migration convertissait
des colonnes Integer supposees pre-existantes, mais aucune migration
intermediaire ne creait ces colonnes -- la chaine `alembic upgrade
head` echouait donc depuis une base vide avec
`KeyError: 'latitude'`. La migration cree ainsi les colonnes,
conformement au modele app.models.pos.POS.

La revision depend des deux tetes pre-existantes (c1d2e3f4a5b6 -> ...
-> e5f6a7b8c9d0 ET la branche d3e4f5a6b7c8) afin de reunifier la chaine
sous une seule tete : `alembic upgrade head` redevient utilisable.

Revision ID: b4d6f8a0c2e4
Revises: ('e5f6a7b8c9d0', 'd3e4f5a6b7c8')
Create Date: 2026-08-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4d6f8a0c2e4'
down_revision: Union[str, Sequence[str], None] = ('e5f6a7b8c9d0', 'd3e4f5a6b7c8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pos', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('pos', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    # Le downgrade supprime les colonnes GPS.
    op.drop_column('pos', 'longitude')
    op.drop_column('pos', 'latitude')
