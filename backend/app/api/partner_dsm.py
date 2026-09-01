"""Ressources DSM sous /api/partners/{partner_id}/dsm."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.core.database import get_db
from app.core.errors import NotFoundError
from app.api.deps import get_current_user, get_partner_context
from app.crud.partner_crud import dsm_crud
from app.models.user import User
from app.models.dsm import DSM
from app.models.pos import POS, TypePos, StatutPos
from app.models.sim import SIM, StatutSim, SIMMovement
from app.models.requete import Requete, RequeteEntite
from app.models.prime import Prime, StatutPrime
from app.models.dsm_commission import DSMCommission, StatutCommission
from app.schemas.partner import DSMBase, DSMOut
from app.services.dsm_identity_service import get_dsm_identity, enrich_dsm_rows
from app.services.pos_linkage_service import get_pos_linkage_stats

router = APIRouter(prefix="/api/partners/{partner_id}/dsm", tags=["DSM"])


@router.get("", response_model=list[DSMOut])
def list_dsm(partner_id: int = Depends(get_partner_context),
             db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Liste des DSM du Partenaire courant (contexte verifie via X-Partner-Context-Id)."""
    dsms = dsm_crud.list(db, partner_id=partner_id, limit=500)
    return enrich_dsm_rows(db, dsms)


@router.get("/dashboard")
def dsm_dashboard(partner_id: int = Depends(get_partner_context),
                  db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Dashboard DSM global : statistiques aggrégées pour tous les DSM du partenaire.
    
    Inclut les sections spécifiques demandées :
    - Stocks initiaux (POS création / reconduction)
    - Activité mensuelle (Création / Redéploiement)
    - Stocks finaux
    - Requêtes (traitées / non traitées / en cours)
    - SIM (linkées / délinkées)
    - Performance (Sell-out / Loading)
    - Prime (Prime période / Prime validée)
    """
    from datetime import date as _date
    from app.models.pos_performance import POSPerformance
    from app.models.partner import PartnerSalesTarget
    
    # Récupérer tous les DSM du partenaire avec leurs statistiques de base
    dsm_stats = (
        db.query(
            DSM.id,
            DSM.matricule,
            DSM.full_name,
            DSM.zone,
            func.count(POS.id).label('nb_pos_crees'),
            func.sum(case((POS.status == StatutPos.ACTIF, 1), else_=0)).label('nb_pos_actifs'),
            func.sum(case((POS.type_pos == TypePos.NOUVEAU, 1), else_=0)).label('nb_pos_nouveaux'),
            func.sum(case((POS.type_pos == TypePos.RECONDUIT, 1), else_=0)).label('nb_pos_reconduits'),
            func.sum(case((POS.holder_user_id.isnot(None), 1), else_=0)).label('nb_pos_linkes'),
            func.sum(case((POS.holder_user_id.is_(None), 1), else_=0)).label('nb_pos_delinkes'),
        )
        .outerjoin(POS, (POS.partner_id == partner_id) & (POS.dsm_id == DSM.id))
        .filter(DSM.partner_id == partner_id)
        .group_by(DSM.id, DSM.matricule, DSM.full_name, DSM.zone)
        .all()
    )
    
    if not dsm_stats:
        return {
            "partner_id": partner_id,
            "total_dsm": 0,
            "dsms": [],
            "global_stats": {
                "total_pos_crees": 0,
                "total_pos_actifs": 0,
                "total_loading": 0,
                "total_sell_out": 0,
                "total_recettes": 0,
                "total_requetes": 0,
            },
            "stocks_initiaux": {"creation": 0, "reconduction": 0},
            "activite_mensuelle": {"creation": 0, "redeploiement": 0},
            "stocks_finaux": {"creation": 0, "reconduction": 0},
            "requetes": {"traitees": 0, "non_traitees": 0, "en_cours": 0},
            "sim": {"linkées": 0, "delinkées": 0},
            "performance": {"sell_out": 0, "loading": 0},
            "prime": {"periode": 0, "validee": 0},
        }
    
    dsm_data = []
    total_pos_crees = 0
    total_pos_actifs = 0
    total_loading = 0
    total_sell_out = 0
    total_recettes = 0
    total_requetes = 0

    # Données globales
    global_stock_creation = 0
    global_stock_reconduction = 0
    global_creation_mensuelle = 0
    global_redeploiement_mensuel = 0
    global_requetes_traitees = 0
    global_requetes_non_traitees = 0
    global_sim_linkées = 0
    global_sim_delinkées = 0
    global_primes_periode = 0
    global_primes_validees = 0
    
    for dsm_id, matricule, full_name, zone, nb_pos_crees, nb_pos_actifs, nb_pos_nouveaux, nb_pos_reconduits, nb_pos_linkes, nb_pos_delinkes in dsm_stats:
        nb_pos_crees = int(nb_pos_crees or 0)
        nb_pos_actifs = int(nb_pos_actifs or 0)
        nb_pos_nouveaux = int(nb_pos_nouveaux or 0)
        nb_pos_reconduits = int(nb_pos_reconduits or 0)
        nb_pos_linkes = int(nb_pos_linkes or 0)
        nb_pos_delinkes = int(nb_pos_delinkes or 0)

        # Loading = SIM en stock pour ce DSM
        dsm_loading = db.query(func.count(SIM.id)).join(POS).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
            SIM.status == StatutSim.EN_STOCK
        ).scalar() or 0
        
        # Sell-out = mouvements VENTE/ACTIVATION
        dsm_sell_out = db.query(func.count(SIMMovement.id)).join(SIM, SIMMovement.sim_id == SIM.id).join(
            POS, SIM.pos_id == POS.id
        ).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
            SIMMovement.movement_type.in_(["VENTE", "ACTIVATION"])
        ).scalar() or 0
        
        # Recettes = primes validées/payées
        dsm_recettes = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
            Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE])
        ).scalar() or 0
        
        # Requêtes du DSM
        dsm_requetes_total = db.query(func.count(Requete.id)).filter(
            Requete.partner_id == partner_id,
            Requete.dsm_id == dsm_id,
        ).scalar() or 0
        dsm_requetes_non_traitees = db.query(func.count(Requete.id)).filter(
            Requete.partner_id == partner_id,
            Requete.dsm_id == dsm_id,
            Requete.closed_at.is_(None),
        ).scalar() or 0
        dsm_requetes_traitees = dsm_requetes_total - dsm_requetes_non_traitees

        # SIM linkées / délinkées pour ce DSM
        dsm_sim_linkées = db.query(func.count(SIM.id)).join(POS).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
            POS.holder_user_id.isnot(None),
        ).scalar() or 0
        dsm_sim_delinkées = db.query(func.count(SIM.id)).join(POS).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
            POS.holder_user_id.is_(None),
        ).scalar() or 0

        # Primes pour ce DSM
        dsm_primes_periode = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
        ).scalar() or 0
        dsm_primes_validees = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
            POS.partner_id == partner_id,
            POS.dsm_id == dsm_id,
            Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE]),
        ).scalar() or 0

        # Objectifs et progression
        progression = (nb_pos_actifs / nb_pos_crees * 100) if nb_pos_crees > 0 else 0
        
        dsm_info = {
            "id": dsm_id,
            "matricule": matricule,
            "full_name": full_name,
            "zone": zone,
            "micro_zone": zone,
            "nb_pos_crees": nb_pos_crees,
            "nb_pos_actifs": nb_pos_actifs,
            "nb_pos_nouveaux": nb_pos_nouveaux,
            "nb_pos_reconduits": nb_pos_reconduits,
            "nb_pos_linkes": nb_pos_linkes,
            "nb_pos_delinkes": nb_pos_delinkes,
            "loading": dsm_loading,
            "sell_out": dsm_sell_out,
            "recettes": float(dsm_recettes),
            "requetes_total": dsm_requetes_total,
            "requetes_traitees": dsm_requetes_traitees,
            "requetes_non_traitees": dsm_requetes_non_traitees,
            "sim_linkées": dsm_sim_linkées,
            "sim_delinkées": dsm_sim_delinkées,
            "primes_periode": float(dsm_primes_periode),
            "primes_validees": float(dsm_primes_validees),
            "progression": round(progression, 1),
        }
        
        dsm_data.append(dsm_info)
        
        total_pos_crees += nb_pos_crees
        total_pos_actifs += nb_pos_actifs
        total_loading += dsm_loading
        total_sell_out += dsm_sell_out
        total_recettes += float(dsm_recettes)
        total_requetes += dsm_requetes_total
        global_stock_creation += nb_pos_nouveaux
        global_stock_reconduction += nb_pos_reconduits
        global_creation_mensuelle += nb_pos_nouveaux
        global_redeploiement_mensuel += nb_pos_reconduits
        global_requetes_traitees += dsm_requetes_traitees
        global_requetes_non_traitees += dsm_requetes_non_traitees
        global_sim_linkées += dsm_sim_linkées
        global_sim_delinkées += dsm_sim_delinkées
        global_primes_periode += float(dsm_primes_periode)
        global_primes_validees += float(dsm_primes_validees)

    # Stocks finaux
    stock_final_creation = max(0, global_stock_creation - global_creation_mensuelle)
    stock_final_reconduction = max(0, global_stock_reconduction - global_redeploiement_mensuel)

    return {
        "partner_id": partner_id,
        "total_dsm": len(dsm_stats),
        "dsms": dsm_data,
        "global_stats": {
            "total_pos_crees": total_pos_crees,
            "total_pos_actifs": total_pos_actifs,
            "total_loading": total_loading,
            "total_sell_out": total_sell_out,
            "total_recettes": total_recettes,
            "total_requetes": total_requetes,
        },
        "stocks_initiaux": {
            "creation": global_stock_creation,
            "reconduction": global_stock_reconduction,
        },
        "activite_mensuelle": {
            "creation": global_creation_mensuelle,
            "redeploiement": global_redeploiement_mensuel,
        },
        "stocks_finaux": {
            "creation": stock_final_creation,
            "reconduction": stock_final_reconduction,
        },
        "requetes": {
            "traitees": global_requetes_traitees,
            "non_traitees": global_requetes_non_traitees,
            "en_cours": global_requetes_non_traitees,
        },
        "sim": {
            "linkées": global_sim_linkées,
            "delinkées": global_sim_delinkées,
        },
        "performance": {
            "sell_out": total_sell_out,
            "loading": total_loading,
        },
        "prime": {
            "periode": global_primes_periode,
            "validee": global_primes_validees,
        },
    }


@router.get("/identity/{dsm_id}")
def dsm_identity(dsm_id: int, partner_id: int = Depends(get_partner_context),
                 db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    data = get_dsm_identity(db, partner_id=partner_id, dsm_id=dsm_id)
    if not data:
        raise NotFoundError("DSM introuvable dans ce Partenaire.")
    return data


@router.post("", response_model=DSMOut, status_code=201)
def create_dsm(payload: DSMBase, partner_id: int = Depends(get_partner_context),
               db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Creation d'un DSM rattache au Partenaire courant (partner_id force serveur)."""
    dsm = dsm_crud.create(db, {**payload.model_dump(), "partner_id": partner_id})
    return enrich_dsm_rows(db, [dsm])[0]


@router.get("/{dsm_id}/dashboard")
def dsm_detailed_dashboard(dsm_id: int, partner_id: int = Depends(get_partner_context),
                            db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Dashboard détaillé pour un DSM spécifique avec toutes ses données."""
    
    # Vérifier que le DSM existe et appartient au partenaire
    dsm = dsm_crud.get(db, dsm_id)
    if not dsm or getattr(dsm, "partner_id", None) != partner_id:
        raise NotFoundError("DSM introuvable dans ce Partenaire.")
    
    # 1. Identité du DSM
    identity_data = get_dsm_identity(db, partner_id=partner_id, dsm_id=dsm_id)
    
    # 2. Performance metrics
    # POS créés et actifs
    pos_stats = db.query(
        func.count(POS.id).label('total_pos'),
        func.sum(case((POS.status == StatutPos.ACTIF, 1), else_=0)).label('pos_actifs'),
        func.sum(case((POS.type_pos == TypePos.NOUVEAU, 1), else_=0)).label('pos_nouveaux'),
        func.sum(case((POS.type_pos == TypePos.RECONDUIT, 1), else_=0)).label('pos_reconduits'),
        func.sum(case((POS.holder_user_id.isnot(None), 1), else_=0)).label('pos_linkes'),
        func.sum(case((POS.holder_user_id.is_(None), 1), else_=0)).label('pos_delinkes')
    ).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id
    ).first()
    
    # Loading (SIM en stock)
    loading = db.query(func.count(SIM.id)).join(POS).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        SIM.status == StatutSim.EN_STOCK
    ).scalar() or 0
    
    # Sell-out (activations et ventes)
    sell_out = db.query(func.count(SIMMovement.id)).join(SIM, SIMMovement.sim_id == SIM.id).join(
        POS, SIM.pos_id == POS.id
    ).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        SIMMovement.movement_type.in_(["VENTE", "ACTIVATION"])
    ).scalar() or 0
    
    # Recettes (primes validées/payées)
    recettes = db.query(func.coalesce(func.sum(Prime.montant), 0)).join(POS).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id,
        Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE])
    ).scalar() or 0
    
    # Objectifs et progression (si disponibles)
    # Pour l'instant, on calcule une progression basée sur les POS actifs / POS créés
    total_pos = int(pos_stats.total_pos or 0)
    pos_actifs = int(pos_stats.pos_actifs or 0)
    progression = (pos_actifs / total_pos * 100) if total_pos > 0 else 0
    
    performance_data = {
        "pos_crees": total_pos,
        "pos_actifs": pos_actifs,
        "pos_nouveaux": int(pos_stats.pos_nouveaux or 0),
        "pos_reconduits": int(pos_stats.pos_reconduits or 0),
        "pos_linkes": int(pos_stats.pos_linkes or 0),
        "pos_delinkes": int(pos_stats.pos_delinkes or 0),
        "loading": loading,
        "sell_out": sell_out,
        "recettes": float(recettes),
        "objectifs": None,  # À implémenter avec un modèle d'objectifs
        "progression": round(progression, 1)
    }
    
    # 3. Requêtes du DSM (filtrées par dsm_id)
    requetes = db.query(
        Requete.id,
        Requete.type_requete,
        Requete.titre,
        Requete.date_creation,
        Requete.priorite,
        Requete.delai,
        Requete.date_finalisation,
        Requete.closed_at,
        Requete.nombre_demande,
        Requete.nombre_effectue,
        Requete.nombre_rejete,
        User.full_name.label('demandeur')
    ).join(
        User, Requete.demandeur_id == User.id
    ).filter(
        Requete.partner_id == partner_id,
        Requete.dsm_id == dsm_id
    ).order_by(Requete.date_creation.desc()).limit(50).all()
    requetes_data = []
    for req in requetes:
        progression_req = (req.nombre_effectue / req.nombre_demande * 100) if req.nombre_demande > 0 else 0
        requetes_data.append({
            "id": req.id,
            "date_ouverture": req.date_creation.isoformat() if req.date_creation else None,
            "demandeur": req.demandeur,
            "statut": "Fermé" if req.closed_at else "Ouvert",
            "delai": req.delai,
            "date_fin": req.date_finalisation.isoformat() if req.date_finalisation else None,
            "cas_anomalie": req.titre,
            "progression": round(progression_req, 1),
            "priorite": req.priorite.value,
            "nombre_demande": req.nombre_demande,
            "nombre_effectue": req.nombre_effectue,
            "nombre_rejete": req.nombre_rejete
        })
    
    # 4. Données POS détaillées
    pos_list = db.query(POS).filter(
        POS.partner_id == partner_id,
        POS.dsm_id == dsm_id
    ).order_by(POS.date_creation.desc()).limit(100).all()
    
    pos_data = []
    for pos in pos_list:
        # Calculer les stats par POS
        pos_loading = db.query(func.count(SIM.id)).filter(
            SIM.pos_id == pos.id,
            SIM.status == StatutSim.EN_STOCK
        ).scalar() or 0
        
        pos_sell_out = db.query(func.count(SIMMovement.id)).join(
            SIM, SIMMovement.sim_id == SIM.id
        ).filter(
            SIM.pos_id == pos.id,
            SIMMovement.movement_type.in_(["VENTE", "ACTIVATION"])
        ).scalar() or 0
        
        pos_recettes = db.query(func.coalesce(func.sum(Prime.montant), 0)).filter(
            Prime.pos_id == pos.id,
            Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE])
        ).scalar() or 0
        
        pos_data.append({
            "id": pos.id,
            "code_pos": pos.code_pos,
            "name": pos.name,
            "status": pos.status.value,
            "type_pos": pos.type_pos.value,
            "linkage_status": "LINKED" if pos.holder_user_id else "UNLINKED",
            "zone": pos.zone,
            "address": pos.address,
            "date_creation": pos.date_creation.isoformat() if pos.date_creation else None,
            "date_expiration": pos.date_expiration.isoformat() if pos.date_expiration else None,
            "loading": pos_loading,
            "sell_out": pos_sell_out,
            "recettes": float(pos_recettes),
            "stock_initial": pos.stock_initial,
            "stock_actuel": pos.stock_actuel
        })
    
    return {
        "identity": identity_data,
        "performance": performance_data,
        "requetes": requetes_data,
        "pos": pos_data,
        "summary": {
            "total_requetes": len(requetes_data),
            "requetes_ouvertes": len([r for r in requetes_data if r["statut"] == "Ouvert"]),
            "total_pos": len(pos_data)
        }
    }


@router.get("/{dsm_id}", response_model=DSMOut)
def get_dsm(dsm_id: int, partner_id: int = Depends(get_partner_context),
            db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    dsm = dsm_crud.get(db, dsm_id)
    if not dsm or getattr(dsm, "partner_id", None) != partner_id:
        raise NotFoundError("DSM introuvable dans ce Partenaire.")
    return enrich_dsm_rows(db, [dsm])[0]