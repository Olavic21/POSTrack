from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class POSExpirationAlert(BaseModel):
    pos_id: int
    code_pos: str
    name: str
    date_expiration: str
    jours_restants: int


class DashboardOut(BaseModel):
    partner_id: int
    partner_name: str
    pos_total: int
    pos_nouveau: int
    pos_reconduit: int
    primes_en_attente: int
    primes_validees: int
    montant_primes_periode: Decimal
    requetes_ouvertes: int
    requetes_total: int
    requetes_terminees: int
    bts_saturees: int
    sim_en_stock: int
    sim_assignees: int
    pos_expirations_proches: list[POSExpirationAlert] = []


class DSMDashboardOut(DashboardOut):
    dsm_id: int
    dsm_name: str


class SalesProgressBlock(BaseModel):
    objectif: int | None = None
    cumul: int = 0
    stock_initial: int | None = None
    progression: float | None = None
    recette: int | None = None  # Recettes de vente (chiffre d'affaires) - donnée manquante identifiée


class RevenueGlobalBlock(BaseModel):
    objectif: int | None = None
    realisation: int | None = None
    progression: float | None = None


class PartnerSalesSummaryOut(BaseModel):
    partner_id: int
    partner_name: str
    creation: SalesProgressBlock
    redeploiement: SalesProgressBlock
    sell_out: SalesProgressBlock
    loading: SalesProgressBlock
    revenue_global: RevenueGlobalBlock  # Objectif global de vente


class PartnerSalesTargetBase(BaseModel):
    month: date
    creation_target: int | None = None
    redeployment_target: int | None = None
    sell_out_target: int | None = None
    loading_target: int | None = None
    creation_stock_initial: int | None = None
    redeployment_stock_initial: int | None = None
    revenue_target: int | None = None  # Objectif global de vente (recettes) - donnée manquante identifiée


class PartnerSalesTargetCreate(PartnerSalesTargetBase):
    partner_id: int | None = None


class PartnerSalesTargetOut(PartnerSalesTargetBase):
    id: int
    partner_id: int
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class LoadingByDsmRow(BaseModel):
    dsm_id: int
    dsm_code: str
    dsm_name: str
    loading: int
    objectif: int | None = None
    progression: float | None = None
    recette: int | None = None  # Recettes de vente DSM - donnée manquante identifiée


class DSMSummaryRow(BaseModel):
    dsm_id: int
    dsm_code: str
    dsm_name: str
    objectif_creation: int | None = None
    realisation_creation: int | None = None
    objectif_redeploiement: int | None = None
    realisation_redeploiement: int | None = None
    loading: int | None = None
    sell_out: int | None = None
    recettes: int | None = None  # Recettes de vente DSM - donnée manquante identifiée
    progression_globale: float | None = None


class DSMSummaryOut(BaseModel):
    partner_id: int
    partner_name: str
    by_dsm: list[DSMSummaryRow] = []


class PartnerLoadingSummaryOut(BaseModel):
    partner_id: int
    partner_name: str
    period_start: date | None = None
    period_end: date | None = None
    loading: int
    objectif: int | None = None
    progression: float | None = None
    by_dsm: list[LoadingByDsmRow] = []


class MonthlyMetricRow(BaseModel):
    period: str
    date: date
    prevision: int | None = None
    cumul_prevision: int | None = None
    realisation: int
    cumul_realisation: int
    ecart: int | None = None
    statut: str | None = None


class MonthlyTableBlock(BaseModel):
    label: str
    rows: list[MonthlyMetricRow] = []


class PartnerMonthlyTableOut(BaseModel):
    partner_id: int
    partner_name: str
    sell_out: MonthlyTableBlock
    loading: MonthlyTableBlock
    creation: MonthlyTableBlock
    redeploiement: MonthlyTableBlock
