"""dsm_objective_service : repartition automatique et gestion des objectifs DSM.

Refonte 2026-09 (correctif 118) : objectif individuel 2 POS / DSM, global = somme DSM (59 × 2 = 118 POS).
Distribution entiere tracable : 118 POS / 59 DSM => 59 DSM a 2 POS (=118) si coefficients égaux.
Revenus : 500 000 FCFA / DSM => 29 500 000 FCFA partenaire (59 × 500k). Ancien 110 abandonné.

Algorithme de repartition pondere :
  poids_DSM = coefficient_potentiel micro-zone (defaut 1.0)
  ideal_DSM = global × poids_DSM / somme_poids
  On prend floor(ideal), puis distribue le reste aux plus grandes fractions
  pour que sum == global (evite le bug du dernier DSM a 52 POS).
La somme des objectifs individuels est toujours egale a l'objectif global.
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationErrorApp
from app.models.dsm import DSM
from app.models.partner import MicroZone
from app.models.dsm_objective import DSMObjective
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.services import audit_service


def _get_dsm_zone_coefficient(db: Session, dsm: DSM) -> float:
    """Recupere le coefficient de potentiel de la micro-zone d'un DSM.

    Le lien DSM <-> MicroZone se fait via le champ color_code / zone.
    Si pas de correspondance, le coefficient par defaut est 1.0.
    """
    if dsm.color_code:
        zone = db.query(MicroZone).filter(
            MicroZone.partner_id == dsm.partner_id,
            MicroZone.code == dsm.color_code,
        ).first()
        if zone:
            return zone.potential_coefficient or 1.0

    if dsm.zone:
        zone = db.query(MicroZone).filter(
            MicroZone.partner_id == dsm.partner_id,
            MicroZone.name == dsm.zone,
        ).first()
        if zone:
            return zone.potential_coefficient or 1.0

    return 1.0


def distribute_objectives(
    db: Session,
    *,
    partner_id: int,
    prime_period_id: int,
    global_creation_target: int,
    global_revenue_target: Decimal,
    user_id: int,
) -> dict:
    """Repartit automatiquement les objectifs globaux entre les DSM.

    Retourne les objectifs crees et un resume.
    """
    period = db.query(PrimePeriod).filter(
        PrimePeriod.id == prime_period_id,
        PrimePeriod.partner_id == partner_id,
    ).first()
    if not period:
        raise NotFoundError("Periode de prime introuvable dans ce Partenaire.")

    # Recuperer tous les DSM du partenaire
    dsms = db.query(DSM).filter(DSM.partner_id == partner_id).all()
    if not dsms:
        raise ValidationErrorApp("Aucun DSM trouve pour ce Partenaire.")

    # Calculer les poids
    dsm_weights = []
    for dsm in dsms:
        coefficient = _get_dsm_zone_coefficient(db, dsm)
        dsm_weights.append((dsm, coefficient))

    total_weight = sum(w for _, w in dsm_weights)
    if total_weight <= 0:
        raise ValidationErrorApp("La somme des coefficients de potentiel est invalide.")

    # Distribuer les objectifs — version equitable (fraction tri)
    # Creation POS (entier)
    ideals = []
    for dsm, weight in dsm_weights:
        ideal = Decimal(str(global_creation_target)) * Decimal(str(weight)) / Decimal(str(total_weight))
        ideals.append((dsm, weight, ideal))
    floors = [int(ideal) for _, _, ideal in ideals]  # floor for positive ideals
    fractions = [(ideal - Decimal(floors[idx]), idx) for idx, (_, _, ideal) in enumerate(ideals)]
    total_floors = sum(floors)
    remainder_creation = global_creation_target - total_floors
    fractions.sort(key=lambda x: x[0], reverse=True)
    creation_vals = floors[:]
    for k in range(int(remainder_creation)):
        _, idx = fractions[k % len(fractions)]
        creation_vals[idx] += 1

    # Revenus : travail en centimes pour distribution equitable
    global_revenue_cents = int((Decimal(str(global_revenue_target)) * Decimal("100")).to_integral_value(rounding=ROUND_HALF_UP))
    revenue_ideals = []
    for dsm, weight in dsm_weights:
        ideal_cents = Decimal(str(global_revenue_cents)) * Decimal(str(weight)) / Decimal(str(total_weight))
        revenue_ideals.append(ideal_cents)
    revenue_floors = [int(c) for c in revenue_ideals]
    revenue_fractions = [(revenue_ideals[i] - Decimal(revenue_floors[i]), i) for i in range(len(revenue_ideals))]
    revenue_fractions.sort(key=lambda x: x[0], reverse=True)
    total_rev_floors = sum(revenue_floors)
    remainder_rev_cents = global_revenue_cents - total_rev_floors
    revenue_cents_vals = revenue_floors[:]
    for k in range(int(remainder_rev_cents)):
        _, idx = revenue_fractions[k % len(revenue_fractions)]
        revenue_cents_vals[idx] += 1

    created_objectives = []
    for idx, (dsm, weight) in enumerate(dsm_weights):
        creation_obj = creation_vals[idx]
        revenue_obj = (Decimal(revenue_cents_vals[idx]) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Upsert
        existing = db.query(DSMObjective).filter(
            DSMObjective.dsm_id == dsm.id,
            DSMObjective.prime_period_id == prime_period_id,
        ).first()

        if existing:
            existing.creation_objective = creation_obj
            existing.revenue_objective = revenue_obj
            existing.month = period.start_date
            db.add(existing)
            created_objectives.append(existing)
        else:
            objective = DSMObjective(
                partner_id=partner_id,
                dsm_id=dsm.id,
                prime_period_id=prime_period_id,
                month=period.start_date,
                creation_objective=creation_obj,
                revenue_objective=revenue_obj,
            )
            db.add(objective)
            created_objectives.append(objective)

    db.commit()
    for obj in created_objectives:
        db.refresh(obj)

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="DSM_OBJECTIVES_DISTRIBUTE",
        entity_type="PRIME_PERIOD", entity_id=prime_period_id,
        details=f"{len(created_objectives)} objectif(s) reparti(s) : {global_creation_target} POS, {global_revenue_target} FCFA",
    )

    return {
        "objectives": created_objectives,
        "global_creation_target": global_creation_target,
        "global_revenue_target": global_revenue_target,
        "dsm_count": len(created_objectives),
    }


def update_objective(
    db: Session,
    *,
    partner_id: int,
    objective_id: int,
    creation_objective: int | None = None,
    revenue_objective: Decimal | None = None,
    user_id: int,
    reason: str | None = None,
) -> DSMObjective:
    """Modification manuelle d'un objectif DSM par l'admin.
    
    Enregistre l'ancienne et la nouvelle valeur dans l'audit.
    """
    obj = db.query(DSMObjective).filter(
        DSMObjective.id == objective_id,
        DSMObjective.partner_id == partner_id,
    ).first()
    if not obj:
        raise NotFoundError("Objectif DSM introuvable dans ce Partenaire.")

    # Sauvegarder les anciennes valeurs
    old_creation = obj.creation_objective
    old_revenue = float(obj.revenue_objective) if obj.revenue_objective else 0

    if creation_objective is not None:
        obj.creation_objective = creation_objective
    if revenue_objective is not None:
        obj.revenue_objective = revenue_objective

    db.add(obj)
    db.commit()
    db.refresh(obj)

    # Audit avec traçabilité complète
    new_creation = obj.creation_objective
    new_revenue = float(obj.revenue_objective) if obj.revenue_objective else 0

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id,
        action="DSM_OBJECTIVE_UPDATE",
        entity_type="DSM_OBJECTIVE", entity_id=objective_id,
        dsm_id=obj.dsm_id,
        period_id=obj.prime_period_id,
        old_value=f"POS={old_creation}, FCFA={old_revenue}",
        new_value=f"POS={new_creation}, FCFA={new_revenue}",
        reason=reason,
        details=f"Obj creation={new_creation}, obj revenus={new_revenue}",
    )

    return obj


def get_objectives_for_period(
    db: Session, partner_id: int, prime_period_id: int
) -> list[DSMObjective]:
    """Liste les objectifs DSM pour une periode."""
    return db.query(DSMObjective).filter(
        DSMObjective.partner_id == partner_id,
        DSMObjective.prime_period_id == prime_period_id,
    ).all()


def get_objectives_summary(
    db: Session, partner_id: int, prime_period_id: int
) -> dict:
    """Resume global et par DSM des objectifs d'une periode.

    Filtre les objectifs orphelins (DSM supprime) pour ne pas afficher
    63 POS / 26,5M historiques.
    """
    objectives = get_objectives_for_period(db, partner_id, prime_period_id)
    # Filtrer orphelins
    actual_ids = {r[0] for r in db.query(DSM.id).filter(DSM.partner_id == partner_id).all()}
    filtered = [o for o in objectives if o.dsm_id in actual_ids]
    use = filtered if filtered else objectives

    total_creation = sum(o.creation_objective for o in use)
    total_revenue = sum(
        float(o.revenue_objective) for o in use
    )

    by_dsm = []
    for obj in use:
        dsm = db.query(DSM).filter(DSM.id == obj.dsm_id).first()
        by_dsm.append({
            "dsm_id": obj.dsm_id,
            "dsm_name": dsm.full_name if dsm else f"DSM #{obj.dsm_id}",
            "zone": dsm.zone if dsm else None,
            "creation_objective": obj.creation_objective,
            "revenue_objective": float(obj.revenue_objective),
        })

    return {
        "partner_id": partner_id,
        "prime_period_id": prime_period_id,
        "total_creation_target": total_creation,
        "total_revenue_target": total_revenue,
        "dsm_count": len(use),
        "by_dsm": by_dsm,
    }
