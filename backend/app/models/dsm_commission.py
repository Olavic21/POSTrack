"""Commission DSM pour une periode de primes.

Etendue pour supporter le systeme dual : prime creation + prime revenus.
Chaque enregistrement contient les deux composantes de la prime d'un DSM.
"""
import enum
from sqlalchemy import (
    Column, Integer, ForeignKey, DateTime, Numeric, String, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StatutCommission(str, enum.Enum):
    DRAFT = "DRAFT"
    CALCULATED = "CALCULATED"
    VALIDATED = "VALIDATED"
    PAID = "PAID"
    REJECTED = "REJECTED"


class DSMCommission(Base):
    __tablename__ = "dsm_commissions"

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)
    dsm_id = Column(Integer, ForeignKey("dsm.id"), nullable=False, index=True)
    prime_period_id = Column(Integer, ForeignKey("prime_periods.id"), nullable=False, index=True)

    # --- Champs legacy (conserves pour compatibilite) ---
    eligible_pos_count = Column(Integer, default=0)
    amount = Column(Numeric(12, 2), nullable=False, default=0)
    status = Column(SAEnum(StatutCommission), nullable=False, default=StatutCommission.DRAFT)

    calculated_at = Column(DateTime(timezone=True), nullable=True)
    validated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # --- Nouveaux champs : systeme dual creation + revenus ---

    # Prime creation
    creation_objective = Column(Integer, nullable=True)
    creation_realized = Column(Integer, nullable=True, default=0)
    creation_achievement_pct = Column(Numeric(5, 2), nullable=True)
    creation_prime_amount = Column(Numeric(12, 2), nullable=True, default=0)

    # Prime revenus
    revenue_objective = Column(Numeric(12, 2), nullable=True)
    revenue_realized = Column(Numeric(12, 2), nullable=True, default=0)
    revenue_achievement_pct = Column(Numeric(5, 2), nullable=True)
    revenue_prime_amount = Column(Numeric(12, 2), nullable=True, default=0)

    # Prime totale
    total_prime_amount = Column(Numeric(12, 2), nullable=True, default=0)

    # Copie du nom DSM pour affichage
    dsm_name = Column(String(150), nullable=True)

    dsm = relationship("DSM")
    prime_period = relationship("PrimePeriod")
