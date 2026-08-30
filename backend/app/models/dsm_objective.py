"""Objectif mensuel d'un DSM pour une periode de prime.

Stocke l'objectif de creation de POS et l'objectif de revenus assignes
a chaque DSM, resultant de la repartition automatique (ou manuelle)
des objectifs globaux du partenaire.
"""
from sqlalchemy import (
    Column, Integer, ForeignKey, DateTime, Date, Numeric, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DSMObjective(Base):
    __tablename__ = "dsm_objectives"
    __table_args__ = (
        UniqueConstraint("dsm_id", "prime_period_id", name="uq_dsm_objective_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)
    dsm_id = Column(Integer, ForeignKey("dsm.id"), nullable=False, index=True)
    prime_period_id = Column(Integer, ForeignKey("prime_periods.id"), nullable=False, index=True)
    month = Column(Date, nullable=False, index=True)

    # Objectif creation de POS
    creation_objective = Column(Integer, nullable=False, default=0)

    # Objectif revenus (FCFA)
    revenue_objective = Column(Numeric(12, 2), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    dsm = relationship("DSM")
    prime_period = relationship("PrimePeriod")
