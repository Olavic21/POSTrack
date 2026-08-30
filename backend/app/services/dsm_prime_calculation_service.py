"""dsm_prime_calculation_service : calcul automatique des primes DSM.

Deux niveaux de prime independants mais additionnes :
  PRIME TOTALE DSM = PRIME CREATION POS + PRIME REVENUS

Algorithme :
  1. Recuperer les objectifs DSM pour la periode
  2. Pour chaque DSM :
     a. Compter les POS NOUVEAU crees (prime creation)
     b. Calculer les revenus generes (prime revenus)
     c. Appliquer les grilles configurables
     d. Additionner les deux primes
  3. Produire un resume global et par DSM
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.errors import NotFoundError, ValidationErrorApp
from app.models.pos import POS, TypePos
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.prime import Prime, StatutPrime
from app.models.dsm import DSM
from app.models.dsm_commission import DSMCommission, StatutCommission
from app.models.dsm_objective import DSMObjective
from app.models.prime_grid import GridType
from app.services import audit_service
from app.services.prime_grid_service import get_active_grid, calculate_prime_amount


def _count_pos_created_by_dsm(
    db: Session, partner_id: int, dsm_id: int, period: PrimePeriod
) -> int:
    """Compte les POS NOUVEAU crees par un DSM durant une periode."""
    return db.query(func.count(POS.id)).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        POS.type_pos == TypePos.NOUVEAU,
        POS.date_creation >= period.start_date,
        POS.date_creation <= period.end_date,
    ).scalar() or 0


def _calculate_revenue_by_dsm(
    db: Session, partner_id: int, dsm_id: int
) -> Decimal:
    """Calcule les revenus generes par les POS d'un DSM.

    Revenus = somme des primes VALIDEE ou PAYEE des POS du DSM.
    """
    result = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE]),
    ).scalar()
    return Decimal(str(result)) if result else Decimal("0")


def calculate_dsm_primes_for_period(
    db: Session,
    *,
    partner_id: int,
    user_id: int,
    prime_period_id: int,
) -> dict:
    """Calcule les primes DSM (creation + revenus) pour une periode."""
    period = db.query(PrimePeriod).filter(
        PrimePeriod.id == prime_period_id,
        PrimePeriod.partner_id == partner_id,
    ).first()
    if not period:
        raise NotFoundError("Periode de prime introuvable dans ce Partenaire.")
    if period.status != StatutPeriode.OPEN:
        raise ValidationErrorApp("La periode de prime doit etre OPEN pour lancer un calcul.")

    # Recuperer les objectifs DSM
    objectives = db.query(DSMObjective).filter(
        DSMObjective.partner_id == partner_id,
        DSMObjective.prime_period_id == prime_period_id,
    ).all()
    if not objectives:
        raise ValidationErrorApp(
            "Aucun objectif DSM defini pour cette periode. "
            "Repartissez d'abord les objectifs globaux."
        )

    # Recuperer les grilles actives
    creation_grid = get_active_grid(db, partner_id, GridType.CREATION.value)
    revenue_grid = get_active_grid(db, partner_id, GridType.REVENUE.value)

    if not creation_grid:
        raise ValidationErrorApp("Aucune grille de prime CREATION active. Configurez une grille d'abord.")

    # Calculer les primes pour chaque DSM
    commissions = []
    total_creation_prime = Decimal("0")
    total_revenue_prime = Decimal("0")

    for obj in objectives:
        dsm = db.query(DSM).filter(DSM.id == obj.dsm_id).first()
        if not dsm:
            continue

        # --- Prime creation ---
        pos_created = _count_pos_created_by_dsm(db, partner_id, obj.dsm_id, period)
        creation_obj = obj.creation_objective or 0

        if creation_obj > 0:
            creation_pct = Decimal(str(pos_created)) / Decimal(str(creation_obj)) * Decimal("100")
        else:
            creation_pct = Decimal("0")

        creation_prime = calculate_prime_amount(creation_grid, creation_pct)

        # --- Prime revenus ---
        revenue_realized = _calculate_revenue_by_dsm(db, partner_id, obj.dsm_id)
        revenue_obj = obj.revenue_objective or Decimal("0")

        if revenue_obj > 0:
            revenue_pct = revenue_realized / revenue_obj * Decimal("100")
        else:
            revenue_pct = Decimal("0")

        if revenue_grid and revenue_pct > 0:
            # Pour REVENUE, le montant est un pourcentage du revenu reel
            revenue_pct_rate = calculate_prime_amount(revenue_grid, revenue_pct)
            revenue_prime = (revenue_realized * revenue_pct_rate / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            revenue_prime = Decimal("0")

        # --- Prime totale ---
        total_prime = creation_prime + revenue_prime

        # Upsert dans dsm_commissions
        existing = db.query(DSMCommission).filter(
            DSMCommission.partner_id == partner_id,
            DSMCommission.dsm_id == obj.dsm_id,
            DSMCommission.prime_period_id == prime_period_id,
        ).first()

        if existing:
            existing.eligible_pos_count = pos_created
            existing.amount = total_prime
            existing.creation_objective = creation_obj
            existing.creation_realized = pos_created
            existing.creation_achievement_pct = creation_pct.quantize(Decimal("0.01"))
            existing.creation_prime_amount = creation_prime
            existing.revenue_objective = revenue_obj
            existing.revenue_realized = revenue_realized
            existing.revenue_achievement_pct = revenue_pct.quantize(Decimal("0.01"))
            existing.revenue_prime_amount = revenue_prime
            existing.total_prime_amount = total_prime
            existing.dsm_name = dsm.full_name
            existing.status = StatutCommission.CALCULATED
            existing.calculated_at = func.now()
            db.add(existing)
            commissions.append(existing)
        else:
            commission = DSMCommission(
                partner_id=partner_id,
                dsm_id=obj.dsm_id,
                prime_period_id=prime_period_id,
                eligible_pos_count=pos_created,
                amount=total_prime,
                status=StatutCommission.CALCULATED,
                calculated_at=func.now(),
                creation_objective=creation_obj,
                creation_realized=pos_created,
                creation_achievement_pct=creation_pct.quantize(Decimal("0.01")),
                creation_prime_amount=creation_prime,
                revenue_objective=revenue_obj,
                revenue_realized=revenue_realized,
                revenue_achievement_pct=revenue_pct.quantize(Decimal("0.01")),
                revenue_prime_amount=revenue_prime,
                total_prime_amount=total_prime,
                dsm_name=dsm.full_name,
            )
            db.add(commission)
            commissions.append(commission)

        total_creation_prime += creation_prime
        total_revenue_prime += revenue_prime

    db.commit()
    for c in commissions:
        db.refresh(c)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="DSM_PRIME_CALCULATE",
        entity_type="PRIME_PERIOD", entity_id=prime_period_id,
        details=(
            f"{len(commissions)} commission(s) calculee(s). "
            f"Prime creation totale: {total_creation_prime} FCFA, "
            f"Prime revenus totale: {total_revenue_prime} FCFA"
        ),
    )

    return {
        "commissions": commissions,
        "total_creation_prime": total_creation_prime,
        "total_revenue_prime": total_revenue_prime,
        "total_prime": total_creation_prime + total_revenue_prime,
        "period": period,
    }


def get_partner_prime_summary(
    db: Session, partner_id: int, prime_period_id: int
) -> dict:
    """Resume global des primes DSM pour le dashboard partenaire."""
    period = db.query(PrimePeriod).filter(
        PrimePeriod.id == prime_period_id,
        PrimePeriod.partner_id == partner_id,
    ).first()
    if not period:
        raise NotFoundError("Periode de prime introuvable dans ce Partenaire.")

    commissions = db.query(DSMCommission).filter(
        DSMCommission.partner_id == partner_id,
        DSMCommission.prime_period_id == prime_period_id,
    ).all()

    # Objectifs globaux
    objectives = db.query(DSMObjective).filter(
        DSMObjective.partner_id == partner_id,
        DSMObjective.prime_period_id == prime_period_id,
    ).all()

    total_creation_target = sum(o.creation_objective for o in objectives)
    total_revenue_target = sum(float(o.revenue_objective) for o in objectives)

    total_creation_realized = sum(c.creation_realized or 0 for c in commissions)
    total_revenue_realized = sum(float(c.revenue_realized or 0) for c in commissions)

    total_creation_prime = sum(c.creation_prime_amount or 0 for c in commissions)
    total_revenue_prime = sum(c.revenue_prime_amount or 0 for c in commissions)

    # Taux d'atteinte global
    if total_creation_target > 0:
        global_creation_achievement = round(total_creation_realized / total_creation_target * 100, 1)
    else:
        global_creation_achievement = 0

    if total_revenue_target > 0:
        global_revenue_achievement = round(total_revenue_realized / total_revenue_target * 100, 1)
    else:
        global_revenue_achievement = 0

    by_dsm = []
    for c in commissions:
        by_dsm.append({
            "dsm_id": c.dsm_id,
            "dsm_name": c.dsm_name or f"DSM #{c.dsm_id}",
            "creation_objective": c.creation_objective,
            "creation_realized": c.creation_realized,
            "creation_achievement_pct": float(c.creation_achievement_pct or 0),
            "creation_prime_amount": float(c.creation_prime_amount or 0),
            "revenue_objective": float(c.revenue_objective or 0),
            "revenue_realized": float(c.revenue_realized or 0),
            "revenue_achievement_pct": float(c.revenue_achievement_pct or 0),
            "revenue_prime_amount": float(c.revenue_prime_amount or 0),
            "total_prime_amount": float(c.total_prime_amount or 0),
            "status": c.status.value if c.status else None,
        })

    return {
        "partner_id": partner_id,
        "period_id": prime_period_id,
        "period_code": period.code,
        "period_label": period.label,
        "global_creation_target": total_creation_target,
        "global_creation_realized": total_creation_realized,
        "global_creation_achievement_pct": global_creation_achievement,
        "global_revenue_target": total_revenue_target,
        "global_revenue_realized": total_revenue_realized,
        "global_revenue_achievement_pct": global_revenue_achievement,
        "total_creation_prime": float(total_creation_prime),
        "total_revenue_prime": float(total_revenue_prime),
        "total_prime": float(total_creation_prime + total_revenue_prime),
        "dsm_count": len(commissions),
        "by_dsm": by_dsm,
    }


def get_dsm_prime_detail(
    db: Session, partner_id: int, dsm_id: int, prime_period_id: int
) -> dict:
    """Detail des primes d'un DSM specifique pour une periode."""
    commission = db.query(DSMCommission).filter(
        DSMCommission.partner_id == partner_id,
        DSMCommission.dsm_id == dsm_id,
        DSMCommission.prime_period_id == prime_period_id,
    ).first()

    if not commission:
        return {
            "dsm_id": dsm_id,
            "period_id": prime_period_id,
            "found": False,
        }

    return {
        "dsm_id": dsm_id,
        "dsm_name": commission.dsm_name,
        "period_id": prime_period_id,
        "found": True,
        "creation_objective": commission.creation_objective,
        "creation_realized": commission.creation_realized,
        "creation_achievement_pct": float(commission.creation_achievement_pct or 0),
        "creation_prime_amount": float(commission.creation_prime_amount or 0),
        "revenue_objective": float(commission.revenue_objective or 0),
        "revenue_realized": float(commission.revenue_realized or 0),
        "revenue_achievement_pct": float(commission.revenue_achievement_pct or 0),
        "revenue_prime_amount": float(commission.revenue_prime_amount or 0),
        "total_prime_amount": float(commission.total_prime_amount or 0),
        "status": commission.status.value if commission.status else None,
    }
