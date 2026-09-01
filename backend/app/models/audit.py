"""Journal d'audit des operations sensibles (F-08).

Champs de traçabilité requis :
- DSM, Période, Ancien objectif, Nouvel objectif
- Ancienne règle, Nouvelle règle
- Utilisateur, Date, Action
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric
from sqlalchemy.sql import func

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)

    action = Column(String(100), nullable=False)          # ex: POS_CREATE, PRIME_VALIDATE, OBJECTIVE_UPDATE
    entity_type = Column(String(50), nullable=False)       # ex: POS, DSM, PRIME_PERIOD, PRIME_GRID
    entity_id = Column(Integer, nullable=True)

    # Traçabilité des changements de valeurs
    dsm_id = Column(Integer, ForeignKey("dsm.id"), nullable=True)
    period_id = Column(Integer, ForeignKey("prime_periods.id"), nullable=True)
    old_value = Column(Text, nullable=True)                # Ancienne valeur (objectif, règle, etc.)
    new_value = Column(Text, nullable=True)                # Nouvelle valeur
    old_rule = Column(Text, nullable=True)                 # Ancienne règle de prime
    new_rule = Column(Text, nullable=True)                 # Nouvelle règle de prime
    reason = Column(Text, nullable=True)                   # Motif de la modification

    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
