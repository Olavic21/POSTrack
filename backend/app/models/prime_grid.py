"""Grille de primes configurable par le partenaire.

Une grille contient plusieurs paliers (thresholds) definissant les
montants de prime en fonction du taux d'atteinte.
Deux types de grille : CREATION (prime sur la creation de POS) et
REVENUE (prime sur les revenus generes).
"""
import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class GridType(str, enum.Enum):
    CREATION = "CREATION"
    REVENUE = "REVENUE"


class PrimeGrid(Base):
    __tablename__ = "prime_grids"

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    grid_type = Column(SAEnum(GridType), nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    partner = relationship("Partner")
    thresholds = relationship(
        "PrimeGridThreshold", back_populates="grid",
        cascade="all, delete-orphan", order_by="PrimeGridThreshold.min_pct",
    )
