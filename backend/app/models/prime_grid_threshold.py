"""Palier d'une grille de primes.

Chaque palier definit un intervalle de taux d'atteinte (min_pct, max_pct)
et le montant de prime correspondant. Pour la grille REVENUE, le montant
est un pourcentage du revenu reel (ex: 5.0 = 5%).
"""
from sqlalchemy import (
    Column, Integer, Numeric, ForeignKey, DateTime,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PrimeGridThreshold(Base):
    __tablename__ = "prime_grid_thresholds"

    id = Column(Integer, primary_key=True, index=True)
    grid_id = Column(Integer, ForeignKey("prime_grids.id", ondelete="CASCADE"), nullable=False, index=True)

    # Intervalle de taux d'atteinte (en pourcentage)
    # min_pct inclus, max_pct exclus. max_pct=NULL signifie "pas de limite superieure".
    min_pct = Column(Numeric(5, 2), nullable=False)
    max_pct = Column(Numeric(5, 2), nullable=True)

    # Pour CREATION : montant fixe en FCFA
    # Pour REVENUE : pourcentage du revenu reel (ex: 5.0 = 5%)
    amount = Column(Numeric(12, 2), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    grid = relationship("PrimeGrid", back_populates="thresholds")
