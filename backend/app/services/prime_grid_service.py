"""prime_grid_service : gestion des grilles de primes configurables.

Une grille contient des paliers definissant les montants de prime
en fonction du taux d'atteinte. Deux types :
  - CREATION : montant fixe par palier (FCFA)
  - REVENUE : pourcentage du revenu reel
"""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationErrorApp, ConflictError
from app.models.prime_grid import PrimeGrid, GridType
from app.models.prime_grid_threshold import PrimeGridThreshold
from app.services import audit_service


def create_grid(
    db: Session,
    *,
    partner_id: int,
    name: str,
    grid_type: str,
    thresholds: list[dict],
    user_id: int,
) -> PrimeGrid:
    """Cree une grille avec ses paliers."""
    grid = PrimeGrid(
        partner_id=partner_id,
        name=name,
        grid_type=GridType(grid_type),
        is_active=False,
    )
    db.add(grid)
    db.flush()

    for t in thresholds:
        threshold = PrimeGridThreshold(
            grid_id=grid.id,
            min_pct=Decimal(str(t["min_pct"])),
            max_pct=Decimal(str(t["max_pct"])) if t.get("max_pct") is not None else None,
            amount=Decimal(str(t["amount"])),
        )
        db.add(threshold)

    db.commit()
    db.refresh(grid)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="PRIME_GRID_CREATE",
        entity_type="PRIME_GRID", entity_id=grid.id,
        details=f"Grille '{name}' ({grid_type}) avec {len(thresholds)} palier(s)",
    )

    return grid


def list_grids(db: Session, partner_id: int) -> list[PrimeGrid]:
    """Liste les grilles du partenaire."""
    return db.query(PrimeGrid).filter(
        PrimeGrid.partner_id == partner_id
    ).order_by(PrimeGrid.created_at.desc()).all()


def get_grid(db: Session, partner_id: int, grid_id: int) -> PrimeGrid:
    """Recupere une grille par son ID."""
    grid = db.query(PrimeGrid).filter(
        PrimeGrid.id == grid_id,
        PrimeGrid.partner_id == partner_id,
    ).first()
    if not grid:
        raise NotFoundError("Grille de prime introuvable dans ce Partenaire.")
    return grid


def get_active_grid(db: Session, partner_id: int, grid_type: str) -> PrimeGrid | None:
    """Retourne la grille active pour un type donné."""
    return db.query(PrimeGrid).filter(
        PrimeGrid.partner_id == partner_id,
        PrimeGrid.grid_type == GridType(grid_type),
        PrimeGrid.is_active == True,
    ).first()


def calculate_prime_amount(grid: PrimeGrid, achievement_pct: Decimal) -> Decimal:
    """Applique la grille au taux d'atteinte et retourne le montant.

    Pour CREATION : montant fixe (FCFA)
    Pour REVENUE : pourcentage du revenu reel
    """
    if not grid or not grid.thresholds:
        return Decimal("0")

    for threshold in sorted(grid.thresholds, key=lambda t: t.min_pct, reverse=True):
        min_pct = threshold.min_pct
        max_pct = threshold.max_pct

        if achievement_pct >= min_pct:
            if max_pct is None or achievement_pct < max_pct:
                return threshold.amount

    return Decimal("0")


def set_active_grid(
    db: Session,
    *,
    partner_id: int,
    grid_id: int,
    user_id: int,
) -> PrimeGrid:
    """Definit une grille comme active (desactive les autres du meme type)."""
    grid = get_grid(db, partner_id, grid_id)

    # Desactiver les autres grilles du meme type
    other_grids = db.query(PrimeGrid).filter(
        PrimeGrid.partner_id == partner_id,
        PrimeGrid.grid_type == grid.grid_type,
        PrimeGrid.id != grid_id,
        PrimeGrid.is_active == True,
    ).all()
    for other in other_grids:
        other.is_active = False
        db.add(other)

    grid.is_active = True
    db.add(grid)
    db.commit()
    db.refresh(grid)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="PRIME_GRID_ACTIVATE",
        entity_type="PRIME_GRID", entity_id=grid.id,
        details=f"Grille '{grid.name}' ({grid.grid_type.value}) activee",
    )

    return grid


def update_grid(
    db: Session,
    *,
    partner_id: int,
    grid_id: int,
    name: str | None = None,
    thresholds: list[dict] | None = None,
    user_id: int,
) -> PrimeGrid:
    """Met a jour une grille et ses paliers."""
    grid = get_grid(db, partner_id, grid_id)

    if name:
        grid.name = name

    if thresholds is not None:
        # Supprimer les anciens paliers
        for t in grid.thresholds:
            db.delete(t)
        db.flush()

        # Creer les nouveaux paliers
        for t in thresholds:
            threshold = PrimeGridThreshold(
                grid_id=grid.id,
                min_pct=Decimal(str(t["min_pct"])),
                max_pct=Decimal(str(t["max_pct"])) if t.get("max_pct") is not None else None,
                amount=Decimal(str(t["amount"])),
            )
            db.add(threshold)

    db.add(grid)
    db.commit()
    db.refresh(grid)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="PRIME_GRID_UPDATE",
        entity_type="PRIME_GRID", entity_id=grid.id,
        details=f"Grille '{grid.name}' mise a jour",
    )

    return grid


def delete_grid(
    db: Session,
    *,
    partner_id: int,
    grid_id: int,
    user_id: int,
) -> None:
    """Supprime une grille (seulement si non utilisee)."""
    grid = get_grid(db, partner_id, grid_id)

    if grid.is_active:
        raise ConflictError("Impossible de supprimer une grille active. Desactivez-la d'abord.")

    # Verifier si la grille est utilisee dans des DSMCommission
    from app.models.dsm_commission import DSMCommission
    used = db.query(DSMCommission).filter(
        DSMCommission.partner_id == partner_id,
    ).first()
    # Pour l'instant, on ne verifie pas l'utilisation directe
    # car les commissions n'ont pas de FK vers les grilles

    db.delete(grid)
    db.commit()

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="PRIME_GRID_DELETE",
        entity_type="PRIME_GRID", entity_id=grid_id,
        details=f"Grille '{grid.name}' supprimee",
    )
