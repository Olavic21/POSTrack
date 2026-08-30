"""Routes API pour les objectifs DSM sous /api/partners/{partner_id}/dsm-objectives."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_partner_context, require_roles
from app.models.user import User
from app.security.permissions import Role
from app.schemas.dsm_prime import (
    DSMObjectiveDistributeRequest, DSMObjectiveOut, DSMObjectiveUpdateRequest,
    DSMObjectivesSummaryOut,
)
from app.services.dsm_objective_service import (
    distribute_objectives, update_objective,
    get_objectives_for_period, get_objectives_summary,
)

router = APIRouter(prefix="/api/partners/{partner_id}/dsm-objectives", tags=["Objectifs DSM"])


@router.post("/distribute")
def distribute(
    payload: DSMObjectiveDistributeRequest,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
):
    """Repartit automatiquement les objectifs globaux entre les DSM."""
    result = distribute_objectives(
        db,
        partner_id=partner_id,
        prime_period_id=payload.prime_period_id,
        global_creation_target=payload.global_creation_target,
        global_revenue_target=payload.global_revenue_target,
        user_id=user.id,
    )
    return {
        "message": f"{result['dsm_count']} objectif(s) reparti(s)",
        "global_creation_target": result["global_creation_target"],
        "global_revenue_target": float(result["global_revenue_target"]),
        "dsm_count": result["dsm_count"],
        "objectives": [DSMObjectiveOut.model_validate(o) for o in result["objectives"]],
    }


@router.get("", response_model=list[DSMObjectiveOut])
def list_objectives(
    prime_period_id: int = Query(...),
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Liste les objectifs DSM pour une periode."""
    return get_objectives_for_period(db, partner_id, prime_period_id)


@router.get("/summary", response_model=DSMObjectivesSummaryOut)
def summary(
    prime_period_id: int = Query(...),
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Resume global et par DSM des objectifs."""
    return get_objectives_summary(db, partner_id, prime_period_id)


@router.patch("/{objective_id}", response_model=DSMObjectiveOut)
def update_obj(
    objective_id: int,
    payload: DSMObjectiveUpdateRequest,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
):
    """Modification manuelle d'un objectif DSM."""
    return update_objective(
        db,
        partner_id=partner_id,
        objective_id=objective_id,
        creation_objective=payload.creation_objective,
        revenue_objective=payload.revenue_objective,
        user_id=user.id,
    )
