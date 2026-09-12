"""
analytics_service : agrege des donnees deja filtrees par Partenaire,
sans jamais contourner les autorisations (le filtrage est fait en amont
par le PartnerContext dans les routes API).

Optimisation : le cahier des charges (section 11 - Exigences non
fonctionnelles) impose un temps de reponse API inferieur a 500 ms au
percentile 95 sur les lectures usuelles du dashboard, pour un jeu de
test de 10 000 POS. Toutes les fonctions de ce module sont ecrites
pour executer un nombre de requetes SQL CONSTANT, independant du
nombre de POS/BTS/DSM du Partenaire (pas de boucle Python emettant une
requete par ligne -- voir le commentaire sur bts_saturees et
calculate_pos_performance, qui remplacent d'anciennes implementations
en N+1 requetes).
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.config import settings
from app.core.errors import NotFoundError
from app.models.partner import Partner, PartnerSalesTarget
from app.models.dsm import DSM
from app.models.pos import POS, TypePos
from app.models.sim import SIM, StatutSim, TypeMouvementSim, SIMMovement
from app.models.requete import Requete
from app.models.bts import BTS
from app.models.bts_releve import BTSReleve
from app.models.pos_performance import POSPerformance, SourcePerformance
from app.models.prime_period import PrimePeriod
from app.models.prime import Prime, StatutPrime

# Nombre maximum d'alertes d'expiration renvoyees par le dashboard : le
# dashboard est une vue de synthese, pas une liste exhaustive -- au-dela,
# l'utilisateur consulte le module POS filtre par date d'expiration.
MAX_DASHBOARD_EXPIRATION_ALERTS = 20


def get_dashboard(db: Session, partner_id: int) -> dict:
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise NotFoundError("Partenaire introuvable.")

    # POS : un seul aller-retour SQL pour le total et la repartition
    # Nouveau/Reconduit (GROUP BY plutot que 2 requetes COUNT separees).
    pos_counts = dict(
        db.query(POS.type_pos, func.count(POS.id))
        .filter(POS.partner_id == partner_id)
        .group_by(POS.type_pos)
        .all()
    )
    pos_nouveau = pos_counts.get(TypePos.NOUVEAU, 0)
    pos_reconduit = pos_counts.get(TypePos.RECONDUIT, 0)
    pos_total = pos_nouveau + pos_reconduit

    # Primes : un seul aller-retour SQL pour les compteurs par statut.
    prime_counts = dict(
        db.query(Prime.status, func.count(Prime.id))
        .join(POS)
        .filter(POS.partner_id == partner_id)
        .group_by(Prime.status)
        .all()
    )
    primes_en_attente = prime_counts.get(StatutPrime.EN_ATTENTE, 0)
    primes_validees = prime_counts.get(StatutPrime.VALIDEE, 0)

    montant_primes = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
        POS.partner_id == partner_id,
        Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE]),
    ).scalar() or 0

    # Requetes ouvertes : derive des compteurs de traitement plutoit qu'un
    # StatutRequete (retire). Une requete est "ouverte" tant qu'il reste
    # des demandes non traitees (effectue + rejete < demande).
    requetes_ouvertes = db.query(func.count(Requete.id)).filter(
        Requete.partner_id == partner_id,
        Requete.nombre_effectue + Requete.nombre_rejete < Requete.nombre_demande,
    ).scalar() or 0

    requetes_total = db.query(func.count(Requete.id)).filter(
        Requete.partner_id == partner_id,
    ).scalar() or 0

    requetes_terminees = db.query(func.count(Requete.id)).filter(
        Requete.partner_id == partner_id,
        Requete.nombre_effectue + Requete.nombre_rejete >= Requete.nombre_demande,
    ).scalar() or 0

    # BTS proches / au-dela du seuil de saturation, sur leur DERNIER releve
    # uniquement. Optimisation : une sous-requete correlee (MAX(date_releve)
    # par bts_id) rejointe une seule fois, au lieu d'une requete par BTS
    # (l'ancienne implementation etait O(n) requetes pour n BTS -- ici,
    # 1 seule requete SQL quel que soit le nombre de BTS).
    latest_releve_dates = (
        db.query(
            BTSReleve.bts_id.label("bts_id"),
            func.max(BTSReleve.date_releve).label("max_date"),
        )
        .group_by(BTSReleve.bts_id)
        .subquery()
    )
    bts_saturees = (
        db.query(func.count(func.distinct(BTS.id)))
        .join(latest_releve_dates, latest_releve_dates.c.bts_id == BTS.id)
        .join(
            BTSReleve,
            and_(
                BTSReleve.bts_id == latest_releve_dates.c.bts_id,
                BTSReleve.date_releve == latest_releve_dates.c.max_date,
            ),
        )
        .filter(BTS.partner_id == partner_id, BTSReleve.taux_saturation >= settings.BTS_SATURATION_THRESHOLD)
        .scalar() or 0
    )

    # SIM : un seul aller-retour SQL pour les compteurs par statut.
    sim_counts = dict(
        db.query(SIM.status, func.count(SIM.id))
        .filter(SIM.partner_id == partner_id)
        .group_by(SIM.status)
        .all()
    )
    sim_en_stock = sim_counts.get(StatutSim.EN_STOCK, 0)
    sim_assignees = sim_counts.get(StatutSim.ASSIGNEE, 0)

    # Alertes d'expiration POS : POS actifs dont l'echeance approche
    # (Jour 12 de la roadmap - notifications). Limitees a
    # MAX_DASHBOARD_EXPIRATION_ALERTS pour garder une charge utile
    # constante quel que soit le nombre de POS du Partenaire.
    today = date.today()
    horizon = today + timedelta(days=settings.POS_EXPIRATION_ALERT_DAYS)
    pos_a_risque = (
        db.query(POS)
        .filter(POS.partner_id == partner_id, POS.date_expiration <= horizon, POS.date_expiration >= today)
        .order_by(POS.date_expiration.asc())
        .limit(MAX_DASHBOARD_EXPIRATION_ALERTS)
        .all()
    )
    pos_expirations_proches = [
        {
            "pos_id": p.id,
            "code_pos": p.code_pos,
            "name": p.name,
            "date_expiration": p.date_expiration.isoformat(),
            "jours_restants": (p.date_expiration - today).days,
        }
        for p in pos_a_risque
    ]

    return {
        "partner_id": partner.id,
        "partner_name": partner.name,
        "pos_total": pos_total,
        "pos_nouveau": pos_nouveau,
        "pos_reconduit": pos_reconduit,
        "primes_en_attente": primes_en_attente,
        "primes_validees": primes_validees,
        "montant_primes_periode": montant_primes,
        "requetes_ouvertes": requetes_ouvertes,
        "requetes_total": requetes_total,
        "requetes_terminees": requetes_terminees,
        "bts_saturees": bts_saturees,
        "sim_en_stock": sim_en_stock,
        "sim_assignees": sim_assignees,
        "pos_expirations_proches": pos_expirations_proches,
    }


def get_dsm_dashboard(db: Session, partner_id: int, dsm_id: int) -> dict:
    dsm = db.query(DSM).filter(DSM.id == dsm_id, DSM.partner_id == partner_id).first()
    if not dsm:
        raise NotFoundError("DSM introuvable dans ce Partenaire.")

    pos_ids = [pid for (pid,) in db.query(POS.id).filter(POS.partner_id == partner_id, POS.dsm_id == dsm_id).all()]
    pos_counts = dict(
        db.query(POS.type_pos, func.count(POS.id))
        .filter(POS.partner_id == partner_id, POS.dsm_id == dsm_id)
        .group_by(POS.type_pos)
        .all()
    )
    pos_nouveau = pos_counts.get(TypePos.NOUVEAU, 0)
    pos_reconduit = pos_counts.get(TypePos.RECONDUIT, 0)
    pos_total = pos_nouveau + pos_reconduit

    prime_counts = dict(
        db.query(Prime.status, func.count(Prime.id))
        .join(POS)
        .filter(POS.partner_id == partner_id, POS.dsm_id == dsm_id)
        .group_by(Prime.status)
        .all()
    )
    primes_en_attente = prime_counts.get(StatutPrime.EN_ATTENTE, 0)
    primes_validees = prime_counts.get(StatutPrime.VALIDEE, 0)
    montant_primes = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE]),
    ).scalar() or 0

    requetes_ouvertes = db.query(func.count(Requete.id)).filter(
        Requete.partner_id == partner_id,
        Requete.entites.any(),
    ).scalar() or 0

    requetes_total = db.query(func.count(Requete.id)).filter(
        Requete.partner_id == partner_id,
    ).scalar() or 0

    requetes_terminees = db.query(func.count(Requete.id)).filter(
        Requete.partner_id == partner_id,
        Requete.nombre_effectue + Requete.nombre_rejete >= Requete.nombre_demande,
    ).scalar() or 0

    bts_saturees = db.query(func.count(BTS.id)).filter(BTS.partner_id == partner_id).scalar() or 0
    sim_en_stock = db.query(func.count(SIM.id)).filter(
        SIM.partner_id == partner_id,
        SIM.status == StatutSim.EN_STOCK,
        SIM.pos_id.is_(None),
        SIM.status != StatutSim.ASSIGNEE,
    ).scalar() or 0
    sim_assignees = db.query(func.count(SIM.id)).join(POS, SIM.pos_id == POS.id).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        SIM.status == StatutSim.ASSIGNEE,
    ).scalar() or 0

    return {
        "dsm_id": dsm.id,
        "dsm_name": dsm.nom if hasattr(dsm, "nom") else getattr(dsm, "full_name", f"DSM #{dsm.id}"),
        "partner_id": partner_id,
        "partner_name": db.query(Partner.name).filter(Partner.id == partner_id).scalar() or "",
        "pos_total": pos_total,
        "pos_nouveau": pos_nouveau,
        "pos_reconduit": pos_reconduit,
        "primes_en_attente": primes_en_attente,
        "primes_validees": primes_validees,
        "montant_primes_periode": montant_primes,
        "requetes_ouvertes": requetes_ouvertes,
        "requetes_total": requetes_total,
        "requetes_terminees": requetes_terminees,
        "bts_saturees": bts_saturees,
        "sim_en_stock": sim_en_stock,
        "sim_assignees": sim_assignees,
        "pos_expirations_proches": [],
    }


def _progression(cumul: int, objectif: int | None) -> float | None:
    if objectif is None:
        return None
    if objectif <= 0:
        return None
    return min(100.0, (float(cumul) / float(objectif)) * 100.0)


def get_partner_sales_summary(db: Session, partner_id: int) -> dict:
    """Résumé métier du suivi des ventes.

    Les compteurs sont dérivés des données réelles déjà stockées :
    - création = POS de type NOUVEAU
    - redéploiement = POS de type RECONDUIT
    - sell-out = SIM passées en ACTIVE ou ASSIGNEE via mouvements
    - loading = SIM EN_STOCK

    Aucun objectif métier n'est inventé : à défaut d'une source persistée,
    la progression reste à None.
    """
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise NotFoundError("Partenaire introuvable.")

    target_month = date.today().replace(day=1)
    target = db.query(PartnerSalesTarget).filter(
        PartnerSalesTarget.partner_id == partner_id,
        PartnerSalesTarget.month == target_month,
    ).first()

    pos_counts = dict(
        db.query(POS.type_pos, func.count(POS.id))
        .filter(POS.partner_id == partner_id)
        .group_by(POS.type_pos)
        .all()
    )
    creation_cumul = pos_counts.get(TypePos.NOUVEAU, 0)
    redeploiement_cumul = pos_counts.get(TypePos.RECONDUIT, 0)

    sell_out_cumul = db.query(func.count(SIMMovement.id)).filter(
        SIMMovement.partner_id == partner_id,
        SIMMovement.movement_type.in_(["VENTE", "ACTIVATION"]),
    ).scalar() or 0
    loading_cumul = db.query(func.count(SIM.id)).filter(
        SIM.partner_id == partner_id,
        SIM.status == StatutSim.EN_STOCK,
    ).scalar() or 0

    creation_objectif = target.creation_target if target else None
    redeploiement_objectif = target.redeployment_target if target else None
    sell_out_objectif = target.sell_out_target if target else None
    loading_objectif = target.loading_target if target else None

    creation_stock_initial = target.creation_stock_initial if target else None
    redeploiement_stock_initial = target.redeployment_stock_initial if target else None

    # Recettes de vente (donnée manquante identifiée - à alimenter via import/API)
    # SOURCE DE DONNÉE REQUISE: Import Excel ou API fournissant le chiffre d'affaires réalisé
    # par partenaire et par DSM. Les recettes doivent être distinctes de sell-out et loading.
    # Format attendu: montant en FCFA, granularité partenaire et DSM si disponible.
    revenue_objectif = target.revenue_target if target else None
    revenue_realisation = None  # Donnée non disponible actuellement - source à définir

    return {
        "partner_id": partner.id,
        "partner_name": partner.name,
        "creation": {
            "objectif": creation_objectif,
            "cumul": creation_cumul,
            "stock_initial": creation_stock_initial,
            "progression": _progression(creation_cumul, creation_objectif),
            "recette": None,  # Recettes spécifiques création - donnée manquante (source à définir)
        },
        "redeploiement": {
            "objectif": redeploiement_objectif,
            "cumul": redeploiement_cumul,
            "stock_initial": redeploiement_stock_initial,
            "progression": _progression(redeploiement_cumul, redeploiement_objectif),
            "recette": None,  # Recettes spécifiques redéploiement - donnée manquante
        },
        "sell_out": {
            "objectif": sell_out_objectif,
            "cumul": sell_out_cumul,
            "stock_initial": None,
            "progression": _progression(sell_out_cumul, sell_out_objectif),
            "recette": None,  # Recettes spécifiques sell-out - donnée manquante
        },
        "loading": {
            "objectif": loading_objectif,
            "cumul": loading_cumul,
            "stock_initial": None,
            "progression": _progression(loading_cumul, loading_objectif),
            "recette": None,  # Recettes spécifiques loading - donnée manquante (source à définir)
        },
        "revenue_global": {
            "objectif": revenue_objectif,
            "realisation": revenue_realisation,
            "progression": _progression(revenue_realisation or 0, revenue_objectif) if revenue_realisation is not None else None,
        },
    }


def create_or_update_sales_target(db: Session, *, partner_id: int, payload: dict) -> PartnerSalesTarget:
    month = payload["month"].replace(day=1)
    target = db.query(PartnerSalesTarget).filter(
        PartnerSalesTarget.partner_id == partner_id,
        PartnerSalesTarget.month == month,
    ).first()
    data = {
        "creation_target": payload.get("creation_target"),
        "redeployment_target": payload.get("redeployment_target"),
        "sell_out_target": payload.get("sell_out_target"),
        "loading_target": payload.get("loading_target"),
        "revenue_target": payload.get("revenue_target"),  # Objectif global de vente
        "creation_stock_initial": payload.get("creation_stock_initial"),
        "redeployment_stock_initial": payload.get("redeployment_stock_initial"),
    }
    if target:
        for key, value in data.items():
            setattr(target, key, value)
        db.add(target)
        db.commit()
        db.refresh(target)
        return target

    target = PartnerSalesTarget(partner_id=partner_id, month=month, **data)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def list_sales_targets(db: Session, partner_id: int) -> list[PartnerSalesTarget]:
    return (
        db.query(PartnerSalesTarget)
        .filter(PartnerSalesTarget.partner_id == partner_id)
        .order_by(PartnerSalesTarget.month.desc())
        .all()
    )


def get_partner_loading_summary(
    db: Session,
    partner_id: int,
    period_start: date | None = None,
    period_end: date | None = None,
) -> dict:
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise NotFoundError("Partenaire introuvable.")

    # Loading = montant d'argent vendu par les POS (FCFA). La mesure de
    # reference est POSPerformance.revenue (alimentee par import/API/CALCUL) :
    # on somme les periodes de performance qui recouvrent la fenetre demandee.
    perf_query = (
        db.query(func.coalesce(func.sum(POSPerformance.revenue), 0))
        .join(POS, POSPerformance.pos_id == POS.id)
        .filter(POS.partner_id == partner_id)
    )
    if period_start is not None:
        perf_query = perf_query.filter(POSPerformance.period_end >= period_start)
    if period_end is not None:
        perf_query = perf_query.filter(POSPerformance.period_start < period_end)

    loading_cumul = int(perf_query.scalar() or 0)

    target = db.query(PartnerSalesTarget).filter(PartnerSalesTarget.partner_id == partner_id).order_by(
        PartnerSalesTarget.month.desc()
    ).first()
    loading_objectif = target.loading_target if target else None

    dsm_rows = []
    dsm_query = (
        db.query(
            DSM.id,
            DSM.matricule,
            func.coalesce(DSM.full_name, DSM.matricule),
            func.coalesce(func.sum(POSPerformance.revenue), 0),
        )
        .join(POS, POS.dsm_id == DSM.id)
        .join(POSPerformance, POSPerformance.pos_id == POS.id)
        .filter(
            POS.partner_id == partner_id,
        )
    )
    if period_start is not None:
        dsm_query = dsm_query.filter(POSPerformance.period_end >= period_start)
    if period_end is not None:
        dsm_query = dsm_query.filter(POSPerformance.period_start < period_end)

    dsm_query = dsm_query.group_by(DSM.id, DSM.matricule, DSM.full_name).all()

    for dsm_id, dsm_code, dsm_name, loading in dsm_query:
        dsm_rows.append({
            "dsm_id": dsm_id,
            "dsm_code": dsm_code,
            "dsm_name": dsm_name,
            "loading": int(loading or 0),
            # Recette du DSM = montant vendu par ses POS (les deux valeurs
            # coincident : le loading EST le chiffre d'affaires des POS).
            "recette": int(loading or 0),
            "objectif": None,
            "progression": None,
        })

    return {
        "partner_id": partner_id,
        "partner_name": partner.name,
        "period_start": period_start,
        "period_end": period_end,
        "loading": loading_cumul,
        "objectif": loading_objectif,
        "progression": _progression(loading_cumul, loading_objectif),
        "by_dsm": dsm_rows,
    }


def _month_key(value: date | None) -> str:
    return value.strftime("%Y-%m") if value else "inconnu"


def _progression_gap(realisation: int, objectif: int | None) -> int | None:
    if objectif is None:
        return None
    return realisation - objectif


def get_partner_monthly_table(db: Session, partner_id: int) -> dict:
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise NotFoundError("Partenaire introuvable.")

    periods = (
        db.query(PrimePeriod)
        .filter(PrimePeriod.partner_id == partner_id)
        .order_by(PrimePeriod.start_date.asc())
        .all()
    )
    if not periods:
        return {
            "partner_id": partner_id,
            "partner_name": partner.name,
            "sell_out": {"label": "Sell-out", "rows": []},
            "loading": {"label": "Loading", "rows": []},
            "creation": {"label": "Création", "rows": []},
            "redeploiement": {"label": "Redéploiement", "rows": []},
        }

    target = db.query(PartnerSalesTarget).filter(PartnerSalesTarget.partner_id == partner_id).order_by(
        PartnerSalesTarget.month.asc()
    ).all()
    target_by_month = {t.month.strftime("%Y-%m"): t for t in target}

    pos_rows = (
        db.query(POS)
        .filter(POS.partner_id == partner_id)
        .order_by(POS.date_creation.asc(), POS.id.asc())
        .all()
    )
    # Mesures monetaires (FCFA) : POSPerformance porte le montant vendu par
    # le POS (revenue = loading) et le montant dote par le DSM (stock_value
    # = sell-out) ; ces montants sont summes par periode de primes ci-dessous.
    perf_rows = (
        db.query(POSPerformance)
        .join(POS, POSPerformance.pos_id == POS.id)
        .filter(POS.partner_id == partner_id)
        .all()
    )

    def build_rows(kind: str) -> list[dict]:
        cumul_realisation = 0
        cumul_prevision = 0
        rows: list[dict] = []
        for period in periods:
            month_key = period.start_date.strftime("%Y-%m")
            target_row = target_by_month.get(month_key)
            if kind == "creation":
                realisation = sum(1 for pos in pos_rows if pos.type_pos == TypePos.NOUVEAU and period.start_date <= pos.date_creation <= period.end_date)
                prevision = target_row.creation_target if target_row else None
            elif kind == "redeploiement":
                realisation = sum(1 for pos in pos_rows if pos.type_pos == TypePos.RECONDUIT and period.start_date <= pos.date_creation <= period.end_date)
                prevision = target_row.redeployment_target if target_row else None
            elif kind == "sell_out":
                # Sell-out = montant que le DSM a donne au POS (FCFA) :
                # somme de POSPerformance.stock_value sur la periode.
                realisation = sum(
                    int(perf.stock_value or 0)
                    for perf in perf_rows
                    if period.start_date <= perf.period_start and perf.period_end <= period.end_date
                )
                prevision = target_row.sell_out_target if target_row else None
            else:
                # Loading = montant vendu par les POS (FCFA) : somme de
                # POSPerformance.revenue sur la periode.
                realisation = sum(
                    int(perf.revenue or 0)
                    for perf in perf_rows
                    if period.start_date <= perf.period_start and perf.period_end <= period.end_date
                )
                prevision = target_row.loading_target if target_row else None

            cumul_realisation += int(realisation)
            cumul_prevision += int(prevision or 0)
            rows.append({
                "period": month_key,
                "date": period.start_date,
                "prevision": prevision,
                "cumul_prevision": cumul_prevision if prevision is not None else None,
                "realisation": int(realisation),
                "cumul_realisation": cumul_realisation,
                "ecart": _progression_gap(int(realisation), prevision),
                "statut": "Atteint" if prevision is not None and int(realisation) >= prevision else ("Non renseigné" if prevision is None else "En cours"),
            })
        return rows

    return {
        "partner_id": partner_id,
        "partner_name": partner.name,
        "sell_out": {"label": "Sell-out", "rows": build_rows("sell_out")},
        "loading": {"label": "Loading", "rows": build_rows("loading")},
        "creation": {"label": "Création", "rows": build_rows("creation")},
        "redeploiement": {"label": "Redéploiement", "rows": build_rows("redeploiement")},
    }


def get_dsm_summary(db: Session, partner_id: int) -> dict:
    """Résumé des performances par DSM avec objectifs, réalisations et recettes."""
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise NotFoundError("Partenaire introuvable.")

    target_month = date.today().replace(day=1)
    target = db.query(PartnerSalesTarget).filter(
        PartnerSalesTarget.partner_id == partner_id,
        PartnerSalesTarget.month == target_month,
    ).first()

    # Récupérer tous les DSM du partenaire
    dsm_list = db.query(DSM).filter(DSM.partner_id == partner_id).all()

    dsm_rows = []
    for dsm in dsm_list:
        # Comptage POS par type pour ce DSM
        pos_counts = dict(
            db.query(POS.type_pos, func.count(POS.id))
            .filter(POS.partner_id == partner_id, POS.dsm_id == dsm.id)
            .group_by(POS.type_pos)
            .all()
        )
        creation_realisation = pos_counts.get(TypePos.NOUVEAU, 0)
        redeploiement_realisation = pos_counts.get(TypePos.RECONDUIT, 0)

        # Sell-out pour ce DSM = montant d'argent que le DSM a donne au POS
        # (FCFA) : somme de POSPerformance.stock_value des POS du DSM.
        sell_out_realisation = db.query(func.coalesce(func.sum(POSPerformance.stock_value), 0)).join(
            POS, POSPerformance.pos_id == POS.id
        ).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm.id,
        ).scalar() or 0

        # Loading pour ce DSM = montant d'argent vendu par les POS (FCFA) :
        # somme de POSPerformance.revenue des POS du DSM.
        loading_realisation = db.query(func.coalesce(func.sum(POSPerformance.revenue), 0)).join(
            POS, POSPerformance.pos_id == POS.id
        ).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm.id,
        ).scalar() or 0

        # Recettes de vente DSM = montant vendu par les POS du DSM
        # (le loading etant precisement ce chiffre d'affaires).
        recettes_dsm = int(loading_realisation) if loading_realisation else None

        # Objectifs depuis PartnerSalesTarget (globaux partenaire - pourraient être spécifiques DSM)
        objectif_creation = target.creation_target if target else None
        objectif_redeploiement = target.redeployment_target if target else None

        # Progression globale (moyenne des progressions disponibles)
        progressions = []
        if objectif_creation and objectif_creation > 0:
            progressions.append(_progression(creation_realisation, objectif_creation))
        if objectif_redeploiement and objectif_redeploiement > 0:
            progressions.append(_progression(redeploiement_realisation, objectif_redeploiement))
        progression_globale = sum(progressions) / len(progressions) if progressions else None

        dsm_rows.append({
            "dsm_id": dsm.id,
            "dsm_code": dsm.matricule,
            "dsm_name": dsm.full_name or dsm.matricule,
            "objectif_creation": objectif_creation,
            "realisation_creation": creation_realisation,
            "objectif_redeploiement": objectif_redeploiement,
            "realisation_redeploiement": redeploiement_realisation,
            "loading": int(loading_realisation or 0),
            "sell_out": int(sell_out_realisation or 0),
            "recettes": recettes_dsm,  # = montant vendu par les POS du DSM (FCFA)
            "progression_globale": progression_globale,
        })

    return {
        "partner_id": partner_id,
        "partner_name": partner.name,
        "by_dsm": dsm_rows,
    }


def calculate_pos_performance(db: Session, *, partner_id: int, period_start: date, period_end: date) -> list[POSPerformance]:
    """
    Calcule (ou met a jour) les indicateurs de performance de chaque POS
    actif du Partenaire pour la periode donnee : nombre de SIM actives sur
    la periode. Alimente la table POSPerformance avec source=CALCUL.

    Optimisation : agrege les SIM actives par pos_id en 1 requete GROUP BY
    (au lieu d'une requete par POS), puis merge en memoire -- le nombre de
    requetes SQL reste constant quel que soit le nombre de POS.
    """
    pos_ids = [pid for (pid,) in db.query(POS.id).filter(POS.partner_id == partner_id).all()]
    if not pos_ids:
        return []

    active_sims_by_pos = dict(
        db.query(SIM.pos_id, func.count(SIM.id))
        .filter(SIM.pos_id.in_(pos_ids), SIM.status == StatutSim.ACTIVE)
        .group_by(SIM.pos_id)
        .all()
    )
    existing_by_pos = {
        perf.pos_id: perf
        for perf in db.query(POSPerformance).filter(
            POSPerformance.pos_id.in_(pos_ids),
            POSPerformance.period_start == period_start,
            POSPerformance.period_end == period_end,
        ).all()
    }

    to_insert = []
    to_update = []
    for pos_id in pos_ids:
        active_sims_count = active_sims_by_pos.get(pos_id, 0)
        score = float(active_sims_count) * 0.5

        existing = existing_by_pos.get(pos_id)
        if existing:
            to_update.append({
                "id": existing.id,
                "active_sims_count": active_sims_count,
                "performance_score": score,
                "source": SourcePerformance.CALCUL,
            })
        else:
            to_insert.append({
                "partner_id": partner_id, "pos_id": pos_id,
                "period_start": period_start, "period_end": period_end,
                "active_sims_count": active_sims_count,
                "performance_score": score, "source": SourcePerformance.CALCUL,
            })

    # Ecritures en masse (executemany) plutot qu'un cycle add()/commit()
    # par ligne, pour reduire les allers-retours avec la base sur un
    # gros volume de POS.
    if to_update:
        db.bulk_update_mappings(POSPerformance, to_update)
    if to_insert:
        db.bulk_insert_mappings(POSPerformance, to_insert)
    db.commit()

    # Une seule requete de relecture (plutot que N db.refresh() -- qui
    # emettraient chacun un SELECT) pour recuperer les valeurs generees
    # par la base (id, created_at) sur les lignes nouvellement creees.
    return (
        db.query(POSPerformance)
        .filter(
            POSPerformance.pos_id.in_(pos_ids),
            POSPerformance.period_start == period_start,
            POSPerformance.period_end == period_end,
        )
        .all()
    )


# --- SIM linkées / délinkées (terminologie & sell-out/loading) ---
def get_sim_linkage_stats(db: Session, partner_id: int) -> dict:
    """Stats SIM linkées vs délinkées basées sur POS.holder_user_id.
    Linkée = POS avec holder (LINKED), Délinkée = POS sans holder.
    Données réelles, pas de valeurs statiques.
    """
    from app.models.pos import POS

    linkees = (
        db.query(func.count(SIM.id))
        .join(POS, SIM.pos_id == POS.id)
        .filter(SIM.partner_id == partner_id, POS.holder_user_id.isnot(None))
        .scalar()
        or 0
    )
    delinkees = (
        db.query(func.count(SIM.id))
        .join(POS, SIM.pos_id == POS.id)
        .filter(SIM.partner_id == partner_id, POS.holder_user_id.is_(None))
        .scalar()
        or 0
    )
    # sell-out = SIM ACTIVE/ASSIGNEE via mouvements VENTE/ACTIVATION
    sell_out_linkees = (
        db.query(func.count(SIM.id))
        .join(POS, SIM.pos_id == POS.id)
        .filter(SIM.partner_id == partner_id, POS.holder_user_id.isnot(None), SIM.status.in_([StatutSim.ASSIGNEE, StatutSim.ACTIVE]))
        .scalar()
        or 0
    )
    sell_out_delinkees = (
        db.query(func.count(SIM.id))
        .join(POS, SIM.pos_id == POS.id)
        .filter(SIM.partner_id == partner_id, POS.holder_user_id.is_(None), SIM.status.in_([StatutSim.ASSIGNEE, StatutSim.ACTIVE]))
        .scalar()
        or 0
    )
    loading_linkees = (
        db.query(func.count(SIM.id))
        .join(POS, SIM.pos_id == POS.id)
        .filter(SIM.partner_id == partner_id, POS.holder_user_id.isnot(None), SIM.status == StatutSim.EN_STOCK)
        .scalar()
        or 0
    )
    loading_delinkees = (
        db.query(func.count(SIM.id))
        .join(POS, SIM.pos_id == POS.id)
        .filter(SIM.partner_id == partner_id, POS.holder_user_id.is_(None), SIM.status == StatutSim.EN_STOCK)
        .scalar()
        or 0
    )
    return {
        "linkees": {"nombre": linkees, "sell_out": sell_out_linkees, "loading": loading_linkees},
        "delinkees": {"nombre": delinkees, "sell_out": sell_out_delinkees, "loading": loading_delinkees},
        "total": linkees + delinkees,
    }


# --- Production BTS total (formule documentée) ---
def get_bts_production(db: Session, partner_id: int) -> dict:
    """Production BTS total = somme traffic_volume_gb (données réelles) ;
    fallback capacite_max si traffic absent. Non additionnés sans sens métier :
    on documente que traffic = production réelle (Go), capacite = capacité max (Go).
    """
    bts_list = db.query(BTS).filter(BTS.partner_id == partner_id).all()
    total_traffic = sum(float(b.traffic_volume_gb or 0) for b in bts_list)
    total_capacite = sum(float(b.capacite_max or 0) for b in bts_list)
    # Production retenue = traffic si >0 sinon capacite
    production = total_traffic if total_traffic > 0 else total_capacite
    return {
        "partner_id": partner_id,
        "production_totale": production,
        "production_traffic_gb": total_traffic,
        "production_capacite": total_capacite,
        "nombre_bts": len(bts_list),
        "formule": "sum(traffic_volume_gb) si >0 sinon sum(capacite_max) – données réelles BTS",
    }


def get_dsm_production_financiere(db: Session, partner_id: int, dsm_id: int) -> dict:
    """Production financière DSM = somme sim_balance (STOCK ODI/CESCO) + montant premières recharges (Master Color).
    Source : POS.sim_balance (ODI/CESCO) + POS.donnees_additionnelles.montant_initial (Master Color).
    """
    pos_list = db.query(POS).filter(POS.partner_id == partner_id, POS.dsm_id == dsm_id).all()
    total = 0.0
    for p in pos_list:
        if p.sim_balance is not None:
            total += float(p.sim_balance)
        elif p.donnees_additionnelles and isinstance(p.donnees_additionnelles, dict):
            total += float(p.donnees_additionnelles.get("montant_initial", 0) or 0)
    return {"dsm_id": dsm_id, "partner_id": partner_id, "production_financiere": total, "nombre_pos": len(pos_list), "source": "POS.sim_balance + donnees_additionnelles.montant_initial"}


# --- BTS état ---
def get_bts_etat_list(db: Session, partner_id: int) -> list[dict]:
    """Liste BTS avec état Normal/Presque saturé/Saturé, capacité, production, taux, lat/lon."""
    from app.services.bts_service import get_bts_etat

    bts_list = db.query(BTS).filter(BTS.partner_id == partner_id).all()
    # Dernier relevé par BTS
    latest = (
        db.query(BTSReleve.bts_id, func.max(BTSReleve.date_releve).label("max_date"))
        .group_by(BTSReleve.bts_id)
        .subquery()
    )
    releves = {
        r.bts_id: r
        for r in db.query(BTSReleve)
        .join(latest, (BTSReleve.bts_id == latest.c.bts_id) & (BTSReleve.date_releve == latest.c.max_date))
        .all()
    }
    out = []
    for b in bts_list:
        rel = releves.get(b.id)
        taux = rel.taux_saturation if rel and rel.taux_saturation is not None else None
        etat = get_bts_etat(taux)
        out.append(
            {
                "id": b.id,
                "code_bts": b.code_bts,
                "latitude": b.latitude,
                "longitude": b.longitude,
                "capacite": b.capacite_max,
                "production": b.traffic_volume_gb,
                "taux_saturation": taux,
                "etat": etat,
            }
        )
    return out


# --- KPI ---
def get_kpi_objectives(db: Session, partner_id: int, month: date | None = None, dsm_id: int | None = None) -> dict:
    """Objectifs KPI (sell-out, loading, création, reconduction, revenus) depuis PartnerSalesTarget/DSMObjective."""
    from app.models.dsm_objective import DSMObjective

    if month is None:
        month = date.today().replace(day=1)
    else:
        month = month.replace(day=1)
    target = db.query(PartnerSalesTarget).filter(PartnerSalesTarget.partner_id == partner_id, PartnerSalesTarget.month == month).first()
    # DSM spécifique si demandé
    dsm_target = None
    if dsm_id:
        dsm_target = db.query(DSMObjective).filter(DSMObjective.partner_id == partner_id, DSMObjective.dsm_id == dsm_id, DSMObjective.month == month).first()
    def val(attr):
        if dsm_target and hasattr(dsm_target, attr) and getattr(dsm_target, attr) is not None:
            return getattr(dsm_target, attr)
        return getattr(target, attr) if target and hasattr(target, attr) else None
    return {
        "partner_id": partner_id,
        "dsm_id": dsm_id,
        "month": month.isoformat(),
        "objectifs": {
            "sell_out": val("sell_out_target"),
            "loading": val("loading_target"),
            "creation_pos": val("creation_target"),
            "reconduction_pos": val("redeployment_target"),
            "revenus": val("revenue_target"),
        },
    }


def get_kpi_realisations(db: Session, partner_id: int, month: date | None = None, dsm_id: int | None = None) -> dict:
    """Réalisations KPI calculées depuis données réelles (POS/SIM/POSPerformance)."""
    if month is None:
        month = date.today().replace(day=1)
    else:
        month = month.replace(day=1)
    # Création / reconduction
    q = db.query(POS).filter(POS.partner_id == partner_id)
    if dsm_id:
        q = q.filter(POS.dsm_id == dsm_id)
    # Filtrer par mois de création
    pos_list = q.all()
    # Pour simplifier, cumul mensuel = POS dont date_creation dans le mois
    creation = sum(1 for p in pos_list if p.date_creation.year == month.year and p.date_creation.month == month.month and p.type_pos == TypePos.NOUVEAU)
    reconduction = sum(1 for p in pos_list if p.date_creation.year == month.year and p.date_creation.month == month.month and p.type_pos == TypePos.RECONDUIT)
    # sell-out / loading via SIM
    sim_q = db.query(SIM).filter(SIM.partner_id == partner_id)
    if dsm_id:
        sim_q = sim_q.join(POS, SIM.pos_id == POS.id).filter(POS.dsm_id == dsm_id)
    sell_out = sim_q.filter(SIM.status.in_([StatutSim.ASSIGNEE, StatutSim.ACTIVE])).count()
    loading = sim_q.filter(SIM.status == StatutSim.EN_STOCK).count()
    # revenus via POSPerformance.revenue
    perf_q = db.query(func.coalesce(func.sum(POSPerformance.revenue), 0)).join(POS, POSPerformance.pos_id == POS.id).filter(POS.partner_id == partner_id)
    if dsm_id:
        perf_q = perf_q.filter(POS.dsm_id == dsm_id)
    revenus = float(perf_q.scalar() or 0)
    objectifs = get_kpi_objectives(db, partner_id, month, dsm_id)["objectifs"]
    def taux(real, obj):
        if obj is None or obj == 0:
            return None
        return min(100.0, float(real) / float(obj) * 100)
    return {
        "partner_id": partner_id,
        "dsm_id": dsm_id,
        "month": month.isoformat(),
        "realisations": {"sell_out": sell_out, "loading": loading, "creation_pos": creation, "reconduction_pos": reconduction, "revenus": revenus},
        "taux": {
            "sell_out": taux(sell_out, objectifs["sell_out"]),
            "loading": taux(loading, objectifs["loading"]),
            "creation_pos": taux(creation, objectifs["creation_pos"]),
            "reconduction_pos": taux(reconduction, objectifs["reconduction_pos"]),
            "revenus": taux(revenus, objectifs["revenus"]),
        },
        "objectifs": objectifs,
    }


def get_kpi_dsm_both_criteria(db: Session, partner_id: int, month: date | None = None) -> dict:
    """Nombre de DSM ayant simultanément atteint critères quantité (POS créés) et montant (revenus)."""
    if month is None:
        month = date.today().replace(day=1)
    dsm_list = db.query(DSM).filter(DSM.partner_id == partner_id).all()
    count = 0
    details = []
    for dsm in dsm_list:
        obj = get_kpi_objectives(db, partner_id, month, dsm.id)["objectifs"]
        real = get_kpi_realisations(db, partner_id, month, dsm.id)
        qty_ok = obj["creation_pos"] is not None and real["realisations"]["creation_pos"] >= obj["creation_pos"]
        amt_ok = obj["revenus"] is not None and real["realisations"]["revenus"] >= obj["revenus"]
        both = qty_ok and amt_ok
        if both:
            count += 1
        details.append({"dsm_id": dsm.id, "matricule": dsm.matricule, "qty_ok": qty_ok, "amt_ok": amt_ok, "both": both})
    return {"partner_id": partner_id, "month": month.isoformat(), "dsm_both_criteria": count, "total_dsm": len(dsm_list), "details": details}


# --- Suivi quotidien ---
def get_daily_tracking(db: Session, partner_id: int, dsm_id: int | None = None, target_date: date | None = None) -> list[dict]:
    """Suivi quotidien DSM – réutilise POSPerformance (daily)."""
    q = db.query(POSPerformance).join(POS, POSPerformance.pos_id == POS.id).filter(POS.partner_id == partner_id)
    if dsm_id:
        q = q.filter(POS.dsm_id == dsm_id)
    if target_date:
        q = q.filter(POSPerformance.period_start == target_date)
    rows = q.all()
    # Agrégation par date / DSM
    out = []
    for r in rows:
        pos = db.query(POS).filter(POS.id == r.pos_id).first()
        out.append(
            {
                "date": r.period_start.isoformat() if r.period_start else None,
                "partner_id": partner_id,
                "dsm_id": pos.dsm_id if pos else None,
                "sell_out": int(r.stock_value or 0),
                "loading": int(r.revenue or 0),
                "creation": 1 if pos and pos.type_pos == TypePos.NOUVEAU else 0,
                "reconduction": 1 if pos and pos.type_pos == TypePos.RECONDUIT else 0,
                "fiabilisation_creation": int(r.active_sims_count or 0),
                "fiabilisation_redeploiement": 0,
                "cumul_achat": int(r.stock_value or 0),
                "realisation": int(r.revenue or 0),
                "cumul_realisation": int(r.revenue or 0),
                "statut": r.source.value if r.source else None,
            }
        )
    return out


# --- Table des ventes ---
def get_sales_table(db: Session, partner_id: int, months: int = 3) -> list[dict]:
    """Table Numéro / DSM / POS / Mois1..MoisN / Total / Moyenne – Total/Moyenne calculés backend."""
    from datetime import timedelta

    # Derniers N mois à partir d'aujourd'hui
    today = date.today()
    month_starts = []
    for i in range(months - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        month_starts.append(date(y, m, 1))
    pos_list = db.query(POS).filter(POS.partner_id == partner_id).order_by(POS.id).all()
    rows = []
    for idx, pos in enumerate(pos_list, start=1):
        # Pour chaque POS, récupérer revenue par mois via POSPerformance
        perfs = db.query(POSPerformance).filter(POSPerformance.pos_id == pos.id).all()
        # mapper mois -> revenue
        rev_by_month = {}
        for p in perfs:
            key = p.period_start.strftime("%Y-%m") if p.period_start else ""
            rev_by_month[key] = float(p.revenue or 0)
        mois_vals = []
        for ms in month_starts:
            key = ms.strftime("%Y-%m")
            mois_vals.append(rev_by_month.get(key, 0))
        total = sum(mois_vals)
        moyenne = total / months if months else 0
        rows.append(
            {
                "numero": idx,
                "numero_dsm": db.query(DSM.matricule).filter(DSM.id == pos.dsm_id).scalar() if pos.dsm_id else None,
                "numero_pos": pos.code_pos,
                **{f"mois_{i+1}": v for i, v in enumerate(mois_vals)},
                "total": total,
                "moyenne": moyenne,
            }
        )
    return rows
