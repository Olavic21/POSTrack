"""Primes et PrimePeriod sous /api/partners/{partner_id}/primes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import NotFoundError
from app.api.deps import get_current_user, get_partner_context, require_roles
from app.crud.prime_crud import prime_period_crud, dsm_commission_crud
from app.models.user import User
from app.security.permissions import Role, PRIME_VALIDATION_ROLES
from app.schemas.prime import (
    PrimePeriodCreate, PrimePeriodOut, PrimePeriodStatusUpdate,
    PrimeOut, PrimeCalculateRequest, PrimeStatusUpdate, DSMCommissionOut,
)
from app.schemas.dsm_prime import DSMCommissionExtendedOut, PartnerPrimeSummaryOut
from app.schemas.pagination import Page
from app.services.prime_service import list_primes
from app.services.prime_calculation_service import calculate_primes_for_period, validate_prime
from app.services.dsm_prime_calculation_service import (
    calculate_dsm_primes_for_period, get_partner_prime_summary,
)

router = APIRouter(prefix="/api/partners/{partner_id}/primes", tags=["Primes"])
periods_router = APIRouter(prefix="/api/partners/{partner_id}/prime-periods", tags=["Periodes de prime"])


@periods_router.get("", response_model=list[PrimePeriodOut])
def list_periods(partner_id: int = Depends(get_partner_context), db: Session = Depends(get_db),
                  _user: User = Depends(get_current_user)):
    return prime_period_crud.list(db, partner_id=partner_id)


@periods_router.post("", response_model=PrimePeriodOut, status_code=201)
def create_period(payload: PrimePeriodCreate, partner_id: int = Depends(get_partner_context),
                   db: Session = Depends(get_db),
                   _user: User = Depends(require_roles(Role.ADMIN, Role.CHEF_OPERATIONNEL, Role.OPERATIONNEL))):
    return prime_period_crud.create(db, {**payload.model_dump(), "partner_id": partner_id})


@periods_router.patch("/{period_id}/status", response_model=PrimePeriodOut)
def update_period_status(period_id: int, payload: PrimePeriodStatusUpdate,
                          partner_id: int = Depends(get_partner_context),
                          db: Session = Depends(get_db),
                          _user: User = Depends(require_roles(Role.ADMIN, Role.CHEF_OPERATIONNEL, Role.OPERATIONNEL))):
    period = prime_period_crud.get(db, period_id)
    if not period or period.partner_id != partner_id:
        raise NotFoundError("Periode de prime introuvable dans ce Partenaire.")
    return prime_period_crud.update(db, period, {"status": payload.status})


@router.get("", response_model=Page[PrimeOut])
def list_primes_route(partner_id: int = Depends(get_partner_context), period_id: int | None = None,
                       status: str | None = None, skip: int = 0, limit: int = Query(default=100, le=500),
                       db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return list_primes(db, partner_id, period_id=period_id, status=status, skip=skip, limit=limit)


@router.post("/calculate", status_code=201)
def calculate_route(payload: PrimeCalculateRequest, partner_id: int = Depends(get_partner_context),
                     db: Session = Depends(get_db),
                      user: User = Depends(require_roles(Role.ADMIN, Role.CHEF_OPERATIONNEL))):
    result = calculate_primes_for_period(
        db, partner_id=partner_id, user_id=user.id,
        prime_period_id=payload.prime_period_id, montant_fixe=payload.montant_fixe,
    )
    return {
        "primes_creees": [PrimeOut.model_validate(p) for p in result["primes"]],
        "commissions": [DSMCommissionOut.model_validate(c) for c in result["commissions"]],
    }


@router.patch("/{prime_id}/status", response_model=PrimeOut)
def update_prime_status(prime_id: int, payload: PrimeStatusUpdate,
                         partner_id: int = Depends(get_partner_context),
                         db: Session = Depends(get_db),
                           user: User = Depends(require_roles(*PRIME_VALIDATION_ROLES))):
    return validate_prime(db, partner_id=partner_id, user_id=user.id, prime_id=prime_id,
                           new_status=payload.status.value, commentaire=payload.commentaire)


@router.get("/commissions", response_model=list[DSMCommissionOut])
def list_commissions(partner_id: int = Depends(get_partner_context), period_id: int | None = None,
                      db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return dsm_commission_crud.list(db, partner_id=partner_id, prime_period_id=period_id)


@router.post("/calculate-dsm")
def calculate_dsm_route(
    prime_period_id: int = Query(...),
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.CHEF_OPERATIONNEL)),
):
    """Calcule les primes DSM (creation + revenus) pour une periode."""
    result = calculate_dsm_primes_for_period(
        db, partner_id=partner_id, user_id=user.id, prime_period_id=prime_period_id,
    )
    return {
        "message": f"{len(result['commissions'])} commission(s) calculee(s)",
        "total_creation_prime": float(result["total_creation_prime"]),
        "total_revenue_prime": float(result["total_revenue_prime"]),
        "total_prime": float(result["total_prime"]),
        "commissions": [DSMCommissionExtendedOut.model_validate(c) for c in result["commissions"]],
    }


@router.get("/dsm-summary", response_model=PartnerPrimeSummaryOut)
def dsm_prime_summary(
    prime_period_id: int = Query(...),
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Resume global des primes DSM pour le dashboard partenaire."""
    return get_partner_prime_summary(db, partner_id, prime_period_id)
