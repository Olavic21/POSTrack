"""Routes API pour les grilles de primes sous /api/partners/{partner_id}/prime-grids."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_partner_context, require_roles
from app.models.user import User
from app.security.permissions import Role
from app.schemas.dsm_prime import (
    PrimeGridCreate, PrimeGridOut, PrimeGridUpdate,
)
from app.services.prime_grid_service import (
    create_grid, list_grids, get_grid, update_grid,
    set_active_grid, delete_grid,
)

router = APIRouter(prefix="/api/partners/{partner_id}/prime-grids", tags=["Grilles de primes"])


@router.get("", response_model=list[PrimeGridOut])
def list_all(
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Liste les grilles du partenaire."""
    return list_grids(db, partner_id)


@router.post("", response_model=PrimeGridOut, status_code=201)
def create(
    payload: PrimeGridCreate,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
):
    """Cree une grille avec ses paliers."""
    return create_grid(
        db,
        partner_id=partner_id,
        name=payload.name,
        grid_type=payload.grid_type,
        thresholds=[t.model_dump() for t in payload.thresholds],
        user_id=user.id,
    )


@router.get("/{grid_id}", response_model=PrimeGridOut)
def get_one(
    grid_id: int,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Recupere une grille par son ID."""
    return get_grid(db, partner_id, grid_id)


@router.patch("/{grid_id}", response_model=PrimeGridOut)
def update(
    grid_id: int,
    payload: PrimeGridUpdate,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
):
    """Met a jour une grille et ses paliers."""
    return update_grid(
        db,
        partner_id=partner_id,
        grid_id=grid_id,
        name=payload.name,
        thresholds=[t.model_dump() for t in payload.thresholds] if payload.thresholds else None,
        user_id=user.id,
    )


@router.post("/{grid_id}/activate", response_model=PrimeGridOut)
def activate(
    grid_id: int,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
):
    """Active une grille (desactive les autres du meme type)."""
    return set_active_grid(db, partner_id=partner_id, grid_id=grid_id, user_id=user.id)


@router.delete("/{grid_id}", status_code=204)
def delete(
    grid_id: int,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
):
    """Supprime une grille."""
    delete_grid(db, partner_id=partner_id, grid_id=grid_id, user_id=user.id)
