"""Schemas Pydantic pour les objectifs DSM et les commissions DSM."""

from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


# --- Objectifs DSM ---

class DSMObjectiveDistributeRequest(BaseModel):
    prime_period_id: int
    global_creation_target: int
    global_revenue_target: Decimal = Decimal("0")


class DSMObjectiveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    partner_id: int
    dsm_id: int
    prime_period_id: int
    month: date
    creation_objective: int
    revenue_objective: Decimal
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DSMObjectiveUpdateRequest(BaseModel):
    creation_objective: int | None = None
    revenue_objective: Decimal | None = None
    reason: str | None = None  # Motif de la modification (traçabilité)


class DSMObjectiveSummaryItem(BaseModel):
    dsm_id: int
    dsm_name: str
    zone: str | None = None
    creation_objective: int
    revenue_objective: float


class DSMObjectivesSummaryOut(BaseModel):
    partner_id: int
    prime_period_id: int
    total_creation_target: int
    total_revenue_target: float
    dsm_count: int
    by_dsm: list[DSMObjectiveSummaryItem]


# --- Extension DSMCommission ---

class DSMCommissionExtendedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    partner_id: int
    dsm_id: int
    prime_period_id: int
    eligible_pos_count: int
    amount: Decimal
    status: str
    # Prime creation
    creation_objective: int | None = None
    creation_realized: int | None = None
    creation_achievement_pct: Decimal | None = None
    creation_prime_amount: Decimal | None = None
    # Prime revenus
    revenue_objective: Decimal | None = None
    revenue_realized: Decimal | None = None
    revenue_achievement_pct: Decimal | None = None
    revenue_prime_amount: Decimal | None = None
    # Prime totale
    total_prime_amount: Decimal | None = None
    dsm_name: str | None = None


# --- Resume primes partenaire ---

class PartnerPrimeSummaryDSMItem(BaseModel):
    dsm_id: int
    dsm_name: str
    creation_objective: int | None = None
    creation_realized: int | None = None
    creation_achievement_pct: float = 0
    creation_rate_pct: float = 0
    creation_tier: str | None = None
    creation_prime_amount: float = 0
    creation_generated_amount: float = 0
    creation_prime_rate: float = 0
    creation_qualified: bool = False
    revenue_objective: float = 0
    revenue_realized: float = 0
    revenue_achievement_pct: float = 0
    revenue_rate_pct: float = 0
    revenue_tier: str | None = None
    revenue_prime_amount: float = 0
    revenue_prime_rate: float = 0
    revenue_qualified: bool = False
    double_qualified: bool = False
    prime_status: str | None = None  # PRIMÉ / PRIMÉ_1_COMPOSANTE / NON_PRIMÉ (+ compat PARTIELLEMENT_ATTEINT)
    total_prime_amount: float = 0
    final_rate_pct: float | None = None
    status: str | None = None

    model_config = ConfigDict(extra="ignore")


class PartnerPrimeSummaryOut(BaseModel):
    partner_id: int
    period_id: int
    period_code: str
    period_label: str
    global_creation_target: int
    global_creation_realized: int
    global_creation_achievement_pct: float
    global_creation_rate_pct: float = 0
    global_creation_tier: str | None = None
    global_revenue_target: float
    global_revenue_realized: float
    global_revenue_achievement_pct: float
    global_revenue_rate_pct: float = 0
    global_revenue_tier: str | None = None
    total_creation_prime: float
    total_revenue_prime: float
    total_prime: float
    dsm_count: int
    quantity_qualified_dsm_count: int = 0
    revenue_qualified_dsm_count: int = 0
    double_qualified_dsm_count: int = 0
    by_dsm: list[PartnerPrimeSummaryDSMItem]
