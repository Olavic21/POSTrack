"""Schemas Pydantic pour les objectifs DSM et les grilles de primes."""
from datetime import date
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
    created_at: date | None = None


class DSMObjectiveUpdateRequest(BaseModel):
    creation_objective: int | None = None
    revenue_objective: Decimal | None = None


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


# --- Grilles de primes ---

class PrimeGridThresholdIn(BaseModel):
    min_pct: Decimal
    max_pct: Decimal | None = None
    amount: Decimal


class PrimeGridThresholdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    min_pct: Decimal
    max_pct: Decimal | None = None
    amount: Decimal


class PrimeGridCreate(BaseModel):
    name: str
    grid_type: str  # "CREATION" ou "REVENUE"
    thresholds: list[PrimeGridThresholdIn]


class PrimeGridUpdate(BaseModel):
    name: str | None = None
    thresholds: list[PrimeGridThresholdIn] | None = None


class PrimeGridOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    partner_id: int
    name: str
    grid_type: str
    is_active: bool
    thresholds: list[PrimeGridThresholdOut] = []
    created_at: date | None = None


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
    creation_prime_amount: float = 0
    revenue_objective: float = 0
    revenue_realized: float = 0
    revenue_achievement_pct: float = 0
    revenue_prime_amount: float = 0
    total_prime_amount: float = 0
    status: str | None = None


class PartnerPrimeSummaryOut(BaseModel):
    partner_id: int
    period_id: int
    period_code: str
    period_label: str
    global_creation_target: int
    global_creation_realized: int
    global_creation_achievement_pct: float
    global_revenue_target: float
    global_revenue_realized: float
    global_revenue_achievement_pct: float
    total_creation_prime: float
    total_revenue_prime: float
    total_prime: float
    dsm_count: int
    by_dsm: list[PartnerPrimeSummaryDSMItem]
