"""sync models

Synchronise le schema lie par la chaine de migrations avec les modeles
SQLAlchemy actuels (app.models) :

- suppression de la table `clients` (plus aucun modele Client) ;
- ajout des colonnes mesure bts_releves (debit, connexions, latence,
  statut) ;
- micro_zones : FK sans ondelete (conforme a app.models.partner.MicroZone) ;
- requete_commentaires.statut_apres obsolete -> supprimee ;
- requetes.type_requete : nouveau enum TypeRequete v4 + index compose ;
- users.role : enum Role v4 (ADMIN/MANAGER/CHEF_OPERATIONNEL/OPERATIONNEL).

Equivalence garantie par : `alembic upgrade head` (base vide) puis
`alembic check` -> aucune operation en attente.

Revision ID: 9acf7850aea3
Revises: b4d6f8a0c2e4
Create Date: 2026-08-30 12:25:26.362487

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9acf7850aea3'
down_revision: Union[str, None] = 'b4d6f8a0c2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table `clients` supprimee des modeles -> drop.
    op.drop_table('clients')

    # bts_releves : colonnes de mesure manquantes (modele BTSReleve).
    with op.batch_alter_table('bts_releves', schema=None) as batch_op:
        batch_op.add_column(sa.Column('debit', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('connexions', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('latence', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('statut', sa.String(length=20), server_default='actif', nullable=False))

    # micro_zones : la migration f4b7c1d2e8a3 a cree la FK avec
    # ondelete='CASCADE', absent du modele app.models.partner.MicroZone.
    # SQLite ne permettant pas de modifier un FK innomme, on recree la
    # table sans ondelete (vide a ce stade de la chaine).
    op.drop_table('micro_zones')
    op.create_table(
        'micro_zones',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('partner_id', sa.Integer(), sa.ForeignKey('partners.id'), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('boundaries', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    )
    op.create_index(op.f('ix_micro_zones_id'), 'micro_zones', ['id'], unique=False)
    op.create_index(op.f('ix_micro_zones_partner_id'), 'micro_zones', ['partner_id'], unique=False)

    # requete_commentaires.statut_apres n'existe plus dans le modele.
    with op.batch_alter_table('requete_commentaires', schema=None) as batch_op:
        batch_op.drop_column('statut_apres')

    # requetes : enum TypeRequete v4 + index composite partenaire/type.
    with op.batch_alter_table('requetes', schema=None) as batch_op:
        batch_op.alter_column('type_requete',
               existing_type=sa.VARCHAR(length=21),
               type_=sa.Enum('AJOUT', 'RECONDUCTION', 'DELINKAGE', 'BASCULEMENT', 'AUTRE', name='typerequete'),
               existing_nullable=False)
        batch_op.create_index('ix_requete_partner_type', ['partner_id', 'type_requete'], unique=False)

    # users : enum Role v4.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('role',
               existing_type=sa.VARCHAR(length=10),
               type_=sa.Enum('ADMIN', 'MANAGER', 'CHEF_OPERATIONNEL', 'OPERATIONNEL', name='role'),
               existing_nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('role',
               existing_type=sa.Enum('ADMIN', 'MANAGER', 'CHEF_OPERATIONNEL', 'OPERATIONNEL', name='role'),
               type_=sa.VARCHAR(length=10),
               existing_nullable=False)

    with op.batch_alter_table('requetes', schema=None) as batch_op:
        batch_op.drop_index('ix_requete_partner_type')
        batch_op.alter_column('type_requete',
               existing_type=sa.Enum('AJOUT', 'RECONDUCTION', 'DELINKAGE', 'BASCULEMENT', 'AUTRE', name='typerequete'),
               type_=sa.VARCHAR(length=21),
               existing_nullable=False)

    with op.batch_alter_table('requete_commentaires', schema=None) as batch_op:
        batch_op.add_column(sa.Column('statut_apres', sa.VARCHAR(length=10), nullable=True))

    op.drop_table('micro_zones')

    with op.batch_alter_table('bts_releves', schema=None) as batch_op:
        batch_op.drop_column('statut')
        batch_op.drop_column('latence')
        batch_op.drop_column('connexions')
        batch_op.drop_column('debit')

    op.create_table('clients',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('partner_id', sa.INTEGER(), nullable=False),
    sa.Column('pos_id', sa.INTEGER(), nullable=False),
    sa.Column('full_name', sa.VARCHAR(length=150), nullable=False),
    sa.Column('phone', sa.VARCHAR(length=30), nullable=True),
    sa.Column('id_number', sa.VARCHAR(length=50), nullable=True),
    sa.Column('created_at', sa.DATETIME(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.Column('updated_at', sa.DATETIME(), nullable=True),
    sa.ForeignKeyConstraint(['partner_id'], ['partners.id'], ),
    sa.ForeignKeyConstraint(['pos_id'], ['pos.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.create_index('ix_clients_pos_id', ['pos_id'], unique=False)
        batch_op.create_index('ix_clients_partner_id', ['partner_id'], unique=False)
        batch_op.create_index('ix_clients_id', ['id'], unique=False)
        batch_op.create_index('ix_client_partner_pos', ['partner_id', 'pos_id'], unique=False)