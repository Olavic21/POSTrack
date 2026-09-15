"""Dashboard / Analytics sous /api/partners/{partner_id}/analytics."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_partner_context, require_roles
from app.crud.pos_crud import pos_performance_crud
from app.crud.prime_crud import dsm_commission_crud
from app.models.user import User
from app.security.permissions import Role
from app.schemas.analytics import DashboardOut, DSMDashboardOut, PartnerSalesSummaryOut, PartnerSalesTargetCreate, PartnerSalesTargetOut, PartnerLoadingSummaryOut, DSMSummaryOut
from app.schemas.pos_performance import POSPerformanceOut, POSPerformanceCalculateRequest
from app.schemas.prime import DSMCommissionOut
from app.schemas.pagination import Page
from app.services.analytics_service import (
    get_dashboard, get_dsm_dashboard, calculate_pos_performance,
    get_partner_sales_summary, get_partner_loading_summary, create_or_update_sales_target, list_sales_targets, get_partner_monthly_table, get_dsm_summary,
    get_sim_linkage_stats, get_bts_production, get_dsm_production_financiere, get_bts_etat_list,
    get_kpi_objectives, get_kpi_realisations, get_kpi_dsm_both_criteria, get_daily_tracking, get_sales_table,
    get_dsm_prime_summary, get_dsm_prime_detail,
)

router = APIRouter(prefix="/api/partners/{partner_id}/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db),
              dsm_id: int | None = None, _user: User = Depends(get_current_user)):
    if dsm_id:
        return get_dsm_dashboard(db, partner_id, dsm_id)
    return get_dashboard(db, partner_id)


@router.get("/pos-performance", response_model=Page[POSPerformanceOut])
def list_pos_performance(partner_id: int = Depends(get_partner_context), pos_id: int | None = None,
                          skip: int = 0, limit: int = Query(default=100, le=500),
                          db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return pos_performance_crud.list_paginated(db, skip=skip, limit=limit, partner_id=partner_id, pos_id=pos_id)


@router.get("/sales-summary", response_model=PartnerSalesSummaryOut)
def sales_summary(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return get_partner_sales_summary(db, partner_id)


@router.get("/loading-summary", response_model=PartnerLoadingSummaryOut)
def loading_summary(
    partner_id: int = Depends(get_partner_context),
    period_start: str | None = None,
    period_end: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    from datetime import date as _date

    parsed_start = _date.fromisoformat(period_start) if period_start else None
    parsed_end = _date.fromisoformat(period_end) if period_end else None
    return get_partner_loading_summary(db, partner_id, parsed_start, parsed_end)


@router.get("/monthly-table")
def monthly_table(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return get_partner_monthly_table(db, partner_id)


@router.get("/sales-targets", response_model=list[PartnerSalesTargetOut])
def sales_targets_list(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return list_sales_targets(db, partner_id)


@router.post("/sales-targets", response_model=PartnerSalesTargetOut, status_code=201)
def sales_targets_upsert(payload: PartnerSalesTargetCreate, partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return create_or_update_sales_target(db, partner_id=partner_id, payload=payload.model_dump())


@router.post("/pos-performance/calculate", response_model=list[POSPerformanceOut], status_code=201)
def calculate_pos_performance_route(payload: POSPerformanceCalculateRequest,
                                     partner_id: int = Depends(get_partner_context),
                                     db: Session = Depends(get_db),
                                     _user: User = Depends(require_roles(Role.ADMIN, Role.CHEF_OPERATIONNEL, Role.OPERATIONNEL))):
    return calculate_pos_performance(
        db, partner_id=partner_id, period_start=payload.period_start, period_end=payload.period_end,
    )


@router.get("/commissions", response_model=Page[DSMCommissionOut])
def list_commissions(partner_id: int = Depends(get_partner_context), period_id: int | None = None,
                      skip: int = 0, limit: int = Query(default=100, le=500),
                      db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return dsm_commission_crud.list_paginated(db, skip=skip, limit=limit, partner_id=partner_id,
                                               prime_period_id=period_id)


@router.get("/dsm-summary", response_model=DSMSummaryOut)
def dsm_summary(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return get_dsm_summary(db, partner_id)


# --- Production BTS total (formule documentée) ---
@router.get("/bts-production")
def bts_production(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Production BTS total = sum(traffic) sinon sum(capacite) – données réelles."""
    return get_bts_production(db, partner_id)


@router.get("/bts-etat")
def bts_etat(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """État BTS Normal/Presque saturé/Saturé + capacité/production/taux."""
    return get_bts_etat_list(db, partner_id)


@router.get("/dsm/{dsm_id}/production-financiere")
def dsm_production_financiere(
    dsm_id: int,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    prime_period_id: int | None = None,
    _user: User = Depends(get_current_user),
):
    """Production financière DSM = sum(sim_balance + montant premières recharges). Filtre optionnel par période."""
    return get_dsm_production_financiere(db, partner_id, dsm_id, prime_period_id)


@router.get("/sim-linkage")
def sim_linkage(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """SIM linkées/délinkées avec sell-out/loading – données réelles."""
    return get_sim_linkage_stats(db, partner_id)


@router.get("/kpi/objectives")
def kpi_objectives(partner_id: int = Depends(get_partner_context), month: str | None = None, dsm_id: int | None = None, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    from datetime import date as _date

    m = _date.fromisoformat(month) if month else None
    return get_kpi_objectives(db, partner_id, m, dsm_id)


@router.get("/kpi/realisations")
def kpi_realisations(partner_id: int = Depends(get_partner_context), month: str | None = None, dsm_id: int | None = None, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    from datetime import date as _date

    m = _date.fromisoformat(month) if month else None
    return get_kpi_realisations(db, partner_id, m, dsm_id)


@router.get("/kpi/dsm-both-criteria")
def kpi_dsm_both(partner_id: int = Depends(get_partner_context), month: str | None = None, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    from datetime import date as _date

    m = _date.fromisoformat(month) if month else None
    return get_kpi_dsm_both_criteria(db, partner_id, m)


@router.get("/tracking/daily")
def tracking_daily(partner_id: int = Depends(get_partner_context), dsm_id: int | None = None, date: str | None = None, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Suivi quotidien filtrable par date/mois/DSM/partenaire – calendrier."""
    from datetime import date as _date

    d = _date.fromisoformat(date) if date else None
    return get_daily_tracking(db, partner_id, dsm_id, d)


@router.get("/primes/summary")
def prime_summary(
    partner_id: int = Depends(get_partner_context),
    period_id: int = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Résumé partenaire des primes DSM (source : DSMCommission calculé) — par période."""
    return get_dsm_prime_summary(db, partner_id, period_id)


@router.get("/kpi/dsm-details")
def dsm_prime_details(
    partner_id: int = Depends(get_partner_context),
    dsm_id: int = Query(...),
    period_id: int = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Détail DSM pour une période (source : DSMCommission calculé)."""
    return get_dsm_prime_detail(db, partner_id, dsm_id, period_id)


@router.get("/sales/table")
def sales_table(partner_id: int = Depends(get_partner_context), months: int = Query(default=3, ge=1, le=12), db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Table Numéro/DSM/POS/Mois1..MoisN/Total/Moyenne – Total/Moyenne calculés backend."""
    return get_sales_table(db, partner_id, months)
