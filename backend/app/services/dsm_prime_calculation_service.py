"""dsm_prime_calculation_service : calcul officiel des primes DSM (source unique).

Regle officielle (Phase 3B, config.py) :
  Objectif creation : 200 POS / mois
  Objectif revenus premiere recharge : 500 000 FCFA / mois
  Seuils : <75% -> 0% ; 75-<95% -> 0,1% ; >=95% -> 0,5%
  Deux criteres doivent etre >=75% pour etre eligible.
  Taux final = MIN(taux creation, taux revenus)
  Prime = revenu_reel_qualifiant * taux_final /100
  Exemple : 194/200=97%, 485000/500000=97% -> 0,5% -> 2425 FCFA

Aucune PrimeGrid n'est lue. Aucune grille CREATION/REVENUE ne modifie la prime.
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.errors import NotFoundError, ValidationErrorApp
from app.models.pos import POS, TypePos
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.dsm import DSM
from app.models.dsm_commission import DSMCommission, StatutCommission
from app.models.dsm_objective import DSMObjective
from app.services import audit_service
from app.core.config import settings as settings_ref


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
    db: Session, partner_id: int, dsm_id: int, period: PrimePeriod | None = None,
) -> Decimal:
    """Calcule les revenus éligibles d'un DSM = production financière
    (premières recharges) des POS du DSM, bornée à la période si fournie.

    Source : POS.sim_balance (stock ODI/CESCO) + montant premières
    recharges (Master Color, donnees_additionnelles.montant_initial).
    Phase 3B : on utilise les premières recharges réellement générées
    (et non les primes VALIDEE/PAYEE) comme base de la prime DSM.
    """
    from app.models.pos import POS as _POS

    q = db.query(_POS).filter(_POS.partner_id == partner_id, _POS.dsm_id == dsm_id)
    if period is not None:
        q = q.filter(_POS.date_creation >= period.start_date, _POS.date_creation <= period.end_date)
    total = Decimal("0")
    for p in q.all():
        if p.sim_balance is not None:
            total += Decimal(str(p.sim_balance))
        elif p.donnees_additionnelles and isinstance(p.donnees_additionnelles, dict):
            total += Decimal(str(p.donnees_additionnelles.get("montant_initial", 0) or 0))
    return total


def _prime_rate_for_pct(achievement_pct: Decimal) -> Decimal:
    """Taux de référence configurable : <75 % → 0 ; 75–<95 % → 0,1 % ; >=95 % → 0,5 %."""
    from app.core.config import settings

    low = Decimal(str(settings.PRIME_THRESHOLD_LOW))
    high = Decimal(str(settings.PRIME_THRESHOLD_HIGH))
    if achievement_pct >= high:
        return Decimal(str(settings.PRIME_RATE_HIGH))
    if achievement_pct >= low:
        return Decimal(str(settings.PRIME_RATE_LOW))
    return Decimal("0")


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

    # Calculer les primes pour chaque DSM - aucune grille n'est lue
    commissions = []
    total_creation_prime = Decimal("0")
    total_revenue_prime = Decimal("0")

    for obj in objectives:
        dsm = db.query(DSM).filter(DSM.id == obj.dsm_id).first()
        if not dsm:
            continue

        # --- Réalisation quantité (PU = POS NOUVEAU créés sur la période) ---
        pos_created = _count_pos_created_by_dsm(db, partner_id, obj.dsm_id, period)
        creation_obj = obj.creation_objective or 0

        if creation_obj > 0:
            creation_pct = Decimal(str(pos_created)) / Decimal(str(creation_obj)) * Decimal("100")
        else:
            creation_pct = Decimal("0")

        # --- Réalisation revenus (premières recharges éligibles, bornées période) ---
        revenue_realized = _calculate_revenue_by_dsm(db, partner_id, obj.dsm_id, period)
        revenue_obj = obj.revenue_objective or Decimal("0")

        if revenue_obj > 0:
            revenue_pct = revenue_realized / revenue_obj * Decimal("100")
        else:
            revenue_pct = Decimal("0")

        # --- Taux de référence backend (configurable, jamais en React) ---
        qty_rate = _prime_rate_for_pct(creation_pct)
        rev_rate = _prime_rate_for_pct(revenue_pct)

        # Double critère : la prime n'est applicable que si les DEUX
        # critères atteignent au moins le seuil bas (75 % configurable).
        qty_ok = creation_pct >= Decimal(str(settings_ref.PRIME_THRESHOLD_LOW)) if creation_obj > 0 else False
        rev_ok = revenue_pct >= Decimal(str(settings_ref.PRIME_THRESHOLD_LOW)) if revenue_obj > 0 else False
        eligible = bool(qty_ok and rev_ok)
        # Taux retenu = le plus faible des deux tranches (prudence) ;
        # 0 si non éligible.
        prime_rate = min(qty_rate, rev_rate) if eligible else Decimal("0")

        # --- Primes : creation fixe n'existe plus ; seule prime revenus selon regle officielle ---
        creation_prime = Decimal("0")
        if eligible and prime_rate > 0:
            applied_rate = prime_rate
            revenue_prime = (revenue_realized * applied_rate / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            applied_rate = Decimal("0")
            revenue_prime = Decimal("0")

        # --- Prime totale = prime revenus (creation =0) ---
        total_prime = revenue_prime

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
            existing.status = StatutCommission.ELIGIBLE if eligible else StatutCommission.NON_ELIGIBLE
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
                status=StatutCommission.ELIGIBLE if eligible else StatutCommission.NON_ELIGIBLE,
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
