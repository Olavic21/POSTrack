"""dsm_prime_calculation_service : calcul officiel des primes DSM (source unique).

Regle definitive POSTrack — correctif final 2026-09 :

  PRIME TOTALE = PRIME CREATION + PRIME REVENUS  (deux primes distinctes, calculees independamment)

  Objectif individuel DSM creation : 2 POS / mois
  Objectif individuel DSM revenus premiere recharge : 500 000 FCFA / mois
  Objectif global partenaire = somme des objectifs DSM (59 DSM × 2 = 118 POS ; 59 × 500 000 = 29 500 000 FCFA)
  L'ancien global 110 POS est abandonné — global_creation_target est dérivé des objectifs DSM.
  Grille identique pour les deux primes :
    <75% -> 0% ; [75,85) -> 5% ; [85,95) -> 6% ; [95,+inf) -> 7%

  Prime creation :
    creation_rate = nb POS NOUVEAU du DSM dans periode / 2 *100
    creation_prime_rate = taux selon grille ci-dessus
    creation_generated_amount = somme sim_balance (+ montant_initial) des POS NOUVEAU du DSM dans periode
    creation_prime_amount = creation_generated_amount * creation_prime_rate /100  si creation_rate >=75% sinon 0
    creation_qualified = creation_rate >=75%

  Prime revenus :
    revenue_rate = revenu_1ere_recharge_DSM / 500000 *100
    revenue_prime_rate = taux selon meme grille
    revenue_prime_amount = revenue_realized * revenue_prime_rate /100  si revenue_rate >=75% sinon 0
    revenue_qualified = revenue_rate >=75%

  Prime totale = creation_prime_amount + revenue_prime_amount
  Statut : PRIMÉ si au moins une composante >0, NON_PRIMÉ sinon.
  double_qualified garde comme info secondaire (creation_qualified AND revenue_qualified).

  Source montant = POS.sim_balance (+ donnees_additionnelles.montant_initial fallback)
    bornee a la periode (date_creation dans [start_date, end_date])

Aucune PrimeGrid n'est lue.
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
    (premières recharges) des POS NOUVEAU du DSM, bornée à la période si fournie.

    Source : POS.sim_balance (stock ODI/CESCO) + montant premières
    recharges (Master Color, donnees_additionnelles.montant_initial).
    Uniquement POS.type_pos == NOUVEAU créés dans la période — cohérent avec
    la réalisation création (POS créés pendant la période).
    """
    from app.models.pos import POS as _POS

    q = db.query(_POS).filter(_POS.partner_id == partner_id, _POS.dsm_id == dsm_id, _POS.type_pos == TypePos.NOUVEAU)
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
    """Taux officiel : <75%->0 ; [75,85)->5% ; [85,95)->6% ; >=95%->7% (configurable)."""
    from app.core.config import settings

    low = Decimal(str(settings.PRIME_THRESHOLD_LOW))
    mid = Decimal(str(settings.PRIME_THRESHOLD_MID))
    high = Decimal(str(settings.PRIME_THRESHOLD_HIGH))
    if achievement_pct >= high:
        return Decimal(str(settings.PRIME_RATE_HIGH))
    if achievement_pct >= mid:
        return Decimal(str(settings.PRIME_RATE_MID))
    if achievement_pct >= low:
        return Decimal(str(settings.PRIME_RATE_LOW))
    return Decimal("0")


def get_prime_rate_and_tier(achievement_pct: float | Decimal) -> tuple[Decimal, str]:
    """Retourne (taux, palier_label) pour affichage. Utilise _prime_rate_for_pct."""
    pct = Decimal(str(achievement_pct))
    rate = _prime_rate_for_pct(pct)
    from app.core.config import settings
    low = Decimal(str(settings.PRIME_THRESHOLD_LOW))
    mid = Decimal(str(settings.PRIME_THRESHOLD_MID))
    high = Decimal(str(settings.PRIME_THRESHOLD_HIGH))
    if pct < low:
        tier = "<75% -> 0%"
    elif pct < mid:
        tier = "[75%,85%) -> 5%"
    elif pct < high:
        tier = "[85%,95%) -> 6%"
    else:
        tier = "[95%,+inf) -> 7%"
    return rate, tier


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

        # --- Taux individuels (grille identique, independants) ---
        qty_rate = _prime_rate_for_pct(creation_pct)
        rev_rate = _prime_rate_for_pct(revenue_pct)

        thr = Decimal(str(settings_ref.PRIME_THRESHOLD_LOW))
        qty_ok = creation_pct >= thr if creation_obj > 0 else False
        rev_ok = revenue_pct >= thr if revenue_obj > 0 else False

        # Creation : base monetaire = revenu genere par les POS NOUVEAU du DSM (meme source que revenus)
        # Spec §5-6 : creation_generated_amount = somme du revenu genere par les POS nouveaux du DSM
        creation_generated_amount = revenue_realized  # meme base monetaire (POS.sim_balance des POS NOUVEAU periode)
        if qty_ok and qty_rate > 0 and creation_generated_amount > 0:
            creation_prime = (creation_generated_amount * qty_rate / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            # Si qty non qualified ou montant 0 -> prime creation 0
            # On garde qty_rate pour affichage/palier mais prime 0
            creation_prime = Decimal("0")

        if rev_ok and rev_rate > 0 and revenue_realized > 0:
            revenue_prime = (revenue_realized * rev_rate / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            revenue_prime = Decimal("0")

        # --- Prime totale = creation + revenus (independants) ---
        total_prime = creation_prime + revenue_prime
        eligible = bool(qty_ok or rev_ok) and total_prime > 0  # primé si au moins une composante >0
        # Garder applied_rate legacy pour compat (si besoin) : not used, set to rev_rate if needed
        applied_rate = qty_rate if qty_ok else rev_rate if rev_ok else Decimal("0")

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
    """Resume global des primes DSM pour le dashboard partenaire.

    Objectif global creation = somme des objectifs DSM (59 DSM × 2 = 118 POS).
    Objectif global revenus  = somme des objectifs DSM (59 × 500 000 = 29 500 000 FCFA).
    L'ancien 110 POS est abandonné — on dérive toujours du distribué.
    Palier partenaire calcule sur le meme taux 5/6/7%.
    """
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

    # Objectifs globaux : n'utiliser QUE les DSM actuels rattaches au partenaire
    # (evite les 59 orphelins = 63 POS / 26.5M)
    objectives = db.query(DSMObjective).filter(
        DSMObjective.partner_id == partner_id,
        DSMObjective.prime_period_id == prime_period_id,
    ).all()
    # Filtrer objectifs orphelins (DSM supprime)
    actual_dsm_ids = {r[0] for r in db.query(DSM.id).filter(DSM.partner_id == partner_id).all()}
    filtered_objectives = [o for o in objectives if o.dsm_id in actual_dsm_ids]
    # Si des orphelins existent, l'appelant doit corriger DB, mais on n'affiche pas les orphelins
    if filtered_objectives:
        objectives_for_totals = filtered_objectives
    else:
        objectives_for_totals = []

    # Source de vérité : somme des objectifs DSM distribués (59 DSM × 2 = 118 POS).
    # L'ancien 110 POS est abandonné — on ne lit plus PARTNER_GLOBAL_CREATION_TARGET comme canonique.
    # Garde-fou : si aucune objective, fallback sur nb_DSM × 2, sinon 0.
    from app.core.config import settings as _cfg
    summed_creation = sum(o.creation_objective for o in objectives_for_totals) if objectives_for_totals else sum(o.creation_objective for o in objectives) if objectives else 0
    summed_revenue = sum(float(o.revenue_objective) for o in objectives_for_totals) if objectives_for_totals else sum(float(o.revenue_objective) for o in objectives) if objectives else 0
    # Si somme vide (pas d'objectifs), dériver du nombre de DSM réels × objectif individuel
    if not summed_creation and actual_dsm_ids:
        summed_creation = len(actual_dsm_ids) * int(_cfg.DSM_DEFAULT_CREATION_OBJECTIVE)
    if not summed_revenue and actual_dsm_ids:
        summed_revenue = len(actual_dsm_ids) * float(_cfg.DSM_DEFAULT_REVENUE_OBJECTIVE)
    total_creation_target = summed_creation
    total_revenue_target = summed_revenue
    effective_creation_target_for_rate = total_creation_target if total_creation_target else 1
    effective_revenue_target_for_rate = total_revenue_target if total_revenue_target else 1

    total_creation_realized = sum(c.creation_realized or 0 for c in commissions)
    total_revenue_realized = sum(float(c.revenue_realized or 0) for c in commissions)

    total_creation_prime = sum(c.creation_prime_amount or 0 for c in commissions)
    total_revenue_prime = sum(c.revenue_prime_amount or 0 for c in commissions)

    # Taux d'atteinte global (spec §8 : real / objectif_partenaire *100)
    if effective_creation_target_for_rate > 0:
        global_creation_achievement = round(total_creation_realized / effective_creation_target_for_rate * 100, 1)
    else:
        global_creation_achievement = 0

    if effective_revenue_target_for_rate > 0:
        global_revenue_achievement = round(total_revenue_realized / effective_revenue_target_for_rate * 100, 1)
    else:
        global_revenue_achievement = 0

    # Palier partenaire (meme grille 5/6/7)
    partner_creation_rate, partner_creation_tier = get_prime_rate_and_tier(global_creation_achievement)
    partner_revenue_rate, partner_revenue_tier = get_prime_rate_and_tier(global_revenue_achievement)

    by_dsm = []
    qty_qualified = 0
    rev_qualified = 0
    double_qualified = 0
    primed_count = 0
    for c in commissions:
        qty_rate, qty_tier = get_prime_rate_and_tier(float(c.creation_achievement_pct or 0))
        rev_rate, rev_tier = get_prime_rate_and_tier(float(c.revenue_achievement_pct or 0))
        from app.core.config import settings as _s2
        qty_ok = float(c.creation_achievement_pct or 0) >= float(_s2.PRIME_THRESHOLD_LOW)
        rev_ok = float(c.revenue_achievement_pct or 0) >= float(_s2.PRIME_THRESHOLD_LOW)
        if qty_ok:
            qty_qualified += 1
        if rev_ok:
            rev_qualified += 1
        if qty_ok and rev_ok:
            double_qualified += 1
        creation_prime_amt = float(c.creation_prime_amount or 0)
        revenue_prime_amt = float(c.revenue_prime_amount or 0)
        total_amt = float(c.total_prime_amount or 0)
        # creation_generated_amount = revenue_realized (spec §5) — expose explicitly
        creation_generated_amount = float(c.revenue_realized or 0)
        if total_amt > 0:
            primed_count += 1
        # Statut métier definitif : PRIMÉ si au moins une prime >0, sinon NON_PRIMÉ
        # On distingue PRIMÉ (double) vs PRIMÉ_1_COMPOSANTE (single) pour affichage détaillé
        # Compat ascendante : garder PARTIELLEMENT_ATTEINT / NON_ELIGIBLE comme anciens alias si besoin
        if total_amt > 0 and qty_ok and rev_ok:
            prime_status = "PRIMÉ"
        elif total_amt > 0:
            prime_status = "PRIMÉ_1_COMPOSANTE"
        else:
            # Si qualifié mais prime 0 (ex: montant 0) on garde NON_PRIMÉ mais double info via qualified flags
            prime_status = "NON_PRIMÉ"
        # final_rate legacy : min si double sinon 0 — on garde pour compat, mais le vrai taux est par composante
        final_rate = float(min(qty_rate, rev_rate)) if qty_ok and rev_ok else 0.0
        by_dsm.append({
            "dsm_id": c.dsm_id,
            "dsm_name": c.dsm_name or f"DSM #{c.dsm_id}",
            "creation_objective": c.creation_objective,
            "creation_realized": c.creation_realized,
            "creation_achievement_pct": float(c.creation_achievement_pct or 0),
            "creation_rate_pct": float(qty_rate),
            "creation_tier": qty_tier,
            "creation_qualified": bool(qty_ok),
            "creation_generated_amount": creation_generated_amount,
            "creation_prime_rate": float(qty_rate),
            "creation_prime_amount": creation_prime_amt,
            "revenue_objective": float(c.revenue_objective or 0),
            "revenue_realized": float(c.revenue_realized or 0),
            "revenue_achievement_pct": float(c.revenue_achievement_pct or 0),
            "revenue_rate_pct": float(rev_rate),
            "revenue_tier": rev_tier,
            "revenue_qualified": bool(rev_ok),
            "revenue_prime_rate": float(rev_rate),
            "revenue_prime_amount": revenue_prime_amt,
            "double_qualified": bool(qty_ok and rev_ok),
            "prime_status": prime_status,
            "total_prime_amount": total_amt,
            "final_rate_pct": final_rate,
            "status": c.status.value if c.status else None,
        })

    # Tri : PRIMÉ en premier (total>0) trié par prime décroissante, puis qualifiés non primés, puis non primés
    def _sort_key(item):
        is_primed = 0 if float(item["total_prime_amount"] or 0) > 0 else 1
        # secondaire : qualifié mais non primé (ex: montant 0) avant non qualifié
        is_qualified = 0 if (item["creation_qualified"] or item["revenue_qualified"]) else 1
        # tertiaire : double avant single si besoin
        double_bonus = 0 if item["double_qualified"] else 1
        return (is_primed, is_qualified, double_bonus, -float(item["total_prime_amount"] or 0), -(float(item["creation_achievement_pct"] or 0) + float(item["revenue_achievement_pct"] or 0)))
    by_dsm.sort(key=_sort_key)

    # dsm_count = population réelle du partenaire (59), pas seulement commissions déjà calculées
    # Permet d'afficher 0/59 même quand période DRAFT sans commission, et évite 0/0 trompeur
    dsm_count = len(actual_dsm_ids) if actual_dsm_ids else len(commissions)
    # Si aucune commission mais objectifs existent, générer by_dsm à la volée (live) pour éviter 0/59 vs 1/59 incohérent
    if not commissions and filtered_objectives:
        # Génération live sans persistance (même logique que get_dsm_prime_detail fallback)
        for obj in filtered_objectives:
            pos_created = _count_pos_created_by_dsm(db, partner_id, obj.dsm_id, period)
            rev_real = _calculate_revenue_by_dsm(db, partner_id, obj.dsm_id, period)
            creation_pct = float(pos_created) / float(obj.creation_objective) * 100 if obj.creation_objective else 0
            revenue_pct = float(rev_real) / float(obj.revenue_objective) * 100 if obj.revenue_objective else 0
            qty_rate, qty_tier = get_prime_rate_and_tier(creation_pct)
            rev_rate, rev_tier = get_prime_rate_and_tier(revenue_pct)
            qty_ok = creation_pct >= float(_cfg.PRIME_THRESHOLD_LOW) if obj.creation_objective else False
            rev_ok = revenue_pct >= float(_cfg.PRIME_THRESHOLD_LOW) if obj.revenue_objective else False
            dsm = db.query(DSM).filter(DSM.id == obj.dsm_id).first()
            creation_generated = float(rev_real)
            creation_prime_amt = float((rev_real * qty_rate / 100)) if qty_ok and qty_rate > 0 and creation_generated > 0 else 0.0
            revenue_prime_amt = float((rev_real * rev_rate / 100)) if rev_ok and rev_rate > 0 and float(rev_real) > 0 else 0.0
            total_amt = creation_prime_amt + revenue_prime_amt
            double_q = bool(qty_ok and rev_ok)
            if qty_ok:
                qty_qualified += 1
            if rev_ok:
                rev_qualified += 1
            if double_q:
                double_qualified += 1
            # total_creation_realized etc déjà 0 car pas de commission, mais on peut recalculer global live
            by_dsm.append({
                "dsm_id": obj.dsm_id,
                "dsm_name": dsm.full_name if dsm else f"DSM #{obj.dsm_id}",
                "creation_objective": obj.creation_objective,
                "creation_realized": pos_created,
                "creation_achievement_pct": creation_pct,
                "creation_rate_pct": float(qty_rate),
                "creation_tier": qty_tier,
                "creation_qualified": bool(qty_ok),
                "creation_generated_amount": creation_generated,
                "creation_prime_rate": float(qty_rate),
                "creation_prime_amount": creation_prime_amt,
                "revenue_objective": float(obj.revenue_objective),
                "revenue_realized": float(rev_real),
                "revenue_achievement_pct": revenue_pct,
                "revenue_rate_pct": float(rev_rate),
                "revenue_tier": rev_tier,
                "revenue_qualified": bool(rev_ok),
                "revenue_prime_rate": float(rev_rate),
                "revenue_prime_amount": revenue_prime_amt,
                "double_qualified": double_q,
                "prime_status": "PRIMÉ" if total_amt > 0 and double_q else "PRIMÉ_1_COMPOSANTE" if total_amt > 0 else "NON_PRIMÉ",
                "total_prime_amount": total_amt,
                "final_rate_pct": float(min(qty_rate, rev_rate)) if double_q else 0.0,
                "status": "NON_CALCULE",
            })
        # Recalculer totaux live (puisque commissions vides)
        total_creation_realized = sum(x["creation_realized"] for x in by_dsm)
        total_revenue_realized = sum(x["revenue_realized"] for x in by_dsm)
        total_creation_prime = sum(x["creation_prime_amount"] for x in by_dsm)
        total_revenue_prime = sum(x["revenue_prime_amount"] for x in by_dsm)
        if effective_creation_target_for_rate:
            global_creation_achievement = round(total_creation_realized / effective_creation_target_for_rate * 100, 1)
        if effective_revenue_target_for_rate:
            global_revenue_achievement = round(total_revenue_realized / effective_revenue_target_for_rate * 100, 1)
        partner_creation_rate, partner_creation_tier = get_prime_rate_and_tier(global_creation_achievement)
        partner_revenue_rate, partner_revenue_tier = get_prime_rate_and_tier(global_revenue_achievement)

    return {
        "partner_id": partner_id,
        "period_id": prime_period_id,
        "period_code": period.code,
        "period_label": period.label,
        "global_creation_target": total_creation_target,
        "global_creation_realized": total_creation_realized,
        "global_creation_achievement_pct": global_creation_achievement,
        "global_creation_rate_pct": float(partner_creation_rate),
        "global_creation_tier": partner_creation_tier,
        "global_revenue_target": total_revenue_target,
        "global_revenue_realized": total_revenue_realized,
        "global_revenue_achievement_pct": global_revenue_achievement,
        "global_revenue_rate_pct": float(partner_revenue_rate),
        "global_revenue_tier": partner_revenue_tier,
        "total_creation_prime": float(total_creation_prime),
        "total_revenue_prime": float(total_revenue_prime),
        "total_prime": float(total_creation_prime + total_revenue_prime),
        "dsm_count": dsm_count,
        "quantity_qualified_dsm_count": qty_qualified,
        "revenue_qualified_dsm_count": rev_qualified,
        "double_qualified_dsm_count": double_qualified,
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
        # Fallback : lecture directe objectifs + realisation si pas encore calcule
        obj = db.query(DSMObjective).filter(
            DSMObjective.partner_id == partner_id,
            DSMObjective.dsm_id == dsm_id,
            DSMObjective.prime_period_id == prime_period_id,
        ).first()
        period = db.query(PrimePeriod).filter(PrimePeriod.id == prime_period_id).first()
        if obj and period:
            pos_created = _count_pos_created_by_dsm(db, partner_id, dsm_id, period)
            rev_real = _calculate_revenue_by_dsm(db, partner_id, dsm_id, period)
            creation_pct = float(Decimal(str(pos_created)) / Decimal(str(obj.creation_objective)) * Decimal("100")) if obj.creation_objective else 0
            revenue_pct = float(rev_real / obj.revenue_objective * Decimal("100")) if obj.revenue_objective else 0
            qty_rate, qty_tier = get_prime_rate_and_tier(creation_pct)
            rev_rate, rev_tier = get_prime_rate_and_tier(revenue_pct)
            from app.core.config import settings as _s_tmp
            _thr = Decimal(str(_s_tmp.PRIME_THRESHOLD_LOW))
            qty_ok = Decimal(str(creation_pct)) >= _thr
            rev_ok = Decimal(str(revenue_pct)) >= _thr
            # Calcul independent des deux primes (fallback sans persistance)
            creation_generated = float(rev_real)
            creation_prime_amt = (Decimal(str(creation_generated)) * qty_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if qty_ok and qty_rate > 0 and creation_generated > 0 else Decimal("0")
            revenue_prime_amt = (Decimal(str(float(rev_real))) * rev_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if rev_ok and rev_rate > 0 and float(rev_real) > 0 else Decimal("0")
            total_amt = float(creation_prime_amt + revenue_prime_amt)
            double_q = bool(qty_ok and rev_ok)
            if total_amt > 0 and double_q:
                prime_status = "PRIMÉ"
            elif total_amt > 0:
                prime_status = "PRIMÉ_1_COMPOSANTE"
            else:
                prime_status = "NON_PRIMÉ"
            final_rate = min(qty_rate, rev_rate) if qty_ok and rev_ok else Decimal("0")
            return {
                "dsm_id": dsm_id,
                "period_id": prime_period_id,
                "found": False,
                "creation_objective": obj.creation_objective,
                "creation_realized": pos_created,
                "creation_achievement_pct": round(creation_pct, 2),
                "creation_rate_pct": float(qty_rate),
                "creation_tier": qty_tier,
                "creation_qualified": bool(qty_ok),
                "creation_generated_amount": creation_generated,
                "creation_prime_rate": float(qty_rate),
                "creation_prime_amount": float(creation_prime_amt),
                "revenue_objective": float(obj.revenue_objective),
                "revenue_realized": float(rev_real),
                "revenue_achievement_pct": round(revenue_pct, 2),
                "revenue_rate_pct": float(rev_rate),
                "revenue_tier": rev_tier,
                "revenue_qualified": bool(rev_ok),
                "revenue_prime_rate": float(rev_rate),
                "revenue_prime_amount": float(revenue_prime_amt),
                "double_qualified": double_q,
                "prime_status": prime_status,
                "total_prime_amount": total_amt,
                "final_rate_pct": float(final_rate),
                "status": "NON_CALCULE",
            }
        return {
            "dsm_id": dsm_id,
            "period_id": prime_period_id,
            "found": False,
        }

    qty_rate, qty_tier = get_prime_rate_and_tier(float(commission.creation_achievement_pct or 0))
    rev_rate, rev_tier = get_prime_rate_and_tier(float(commission.revenue_achievement_pct or 0))
    from app.core.config import settings as _s
    qty_ok = float(commission.creation_achievement_pct or 0) >= float(_s.PRIME_THRESHOLD_LOW)
    rev_ok = float(commission.revenue_achievement_pct or 0) >= float(_s.PRIME_THRESHOLD_LOW)
    double_q = bool(qty_ok and rev_ok)
    total_amt = float(commission.total_prime_amount or 0)
    if total_amt > 0 and double_q:
        prime_status = "PRIMÉ"
    elif total_amt > 0:
        prime_status = "PRIMÉ_1_COMPOSANTE"
    else:
        prime_status = "NON_PRIMÉ"
    final_rate = min(qty_rate, rev_rate) if double_q else Decimal("0")
    return {
        "dsm_id": dsm_id,
        "dsm_name": commission.dsm_name,
        "period_id": prime_period_id,
        "found": True,
        "creation_objective": commission.creation_objective,
        "creation_realized": commission.creation_realized,
        "creation_achievement_pct": float(commission.creation_achievement_pct or 0),
        "creation_rate_pct": float(qty_rate),
        "creation_tier": qty_tier,
        "creation_qualified": bool(qty_ok),
        "creation_generated_amount": float(commission.revenue_realized or 0),
        "creation_prime_rate": float(qty_rate),
        "creation_prime_amount": float(commission.creation_prime_amount or 0),
        "revenue_objective": float(commission.revenue_objective or 0),
        "revenue_realized": float(commission.revenue_realized or 0),
        "revenue_achievement_pct": float(commission.revenue_achievement_pct or 0),
        "revenue_rate_pct": float(rev_rate),
        "revenue_tier": rev_tier,
        "revenue_qualified": bool(rev_ok),
        "revenue_prime_rate": float(rev_rate),
        "revenue_prime_amount": float(commission.revenue_prime_amount or 0),
        "double_qualified": double_q,
        "prime_status": prime_status,
        "total_prime_amount": total_amt,
        "final_rate_pct": float(final_rate),
        "status": commission.status.value if commission.status else None,
    }
