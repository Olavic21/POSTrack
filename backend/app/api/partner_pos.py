"""Ressources POS sous /api/partners/{partner_id}/pos."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.core.database import get_db
from app.api.deps import get_current_user, get_partner_context
from app.crud.pos_crud import pos_crud, reconduction_crud
from app.models.user import User
from app.models.pos import TypePos, StatutPos, POS
from app.models.sim import SIM, StatutSim
from app.models.sim import SIMMovement
from app.models.prime import Prime, StatutPrime
from app.schemas.pos import (
    POSCreate, POSUpdate, POSOut, POSOutEnriched, ReconductionCreate, ReconductionOut,
    POSLinkCreate, POSUnlinkCreate, POSLinkOut,
)
from app.schemas.pagination import Page
from app.services.pos_service import (
    create_pos, get_pos_in_partner, reconduire_pos,
    lier_detenteur, delier_detenteur, lister_liens,
)
from app.services.pos_linkage_service import get_pos_linkage_stats, get_pos_type_counts
from app.services.zoning_service import get_pos_zoning, get_zoning_for_coords

router = APIRouter(prefix="/api/partners/{partner_id}/pos", tags=["POS"])


@router.get("", response_model=Page[POSOut])
def list_pos(
    partner_id: int = Depends(get_partner_context),
    type_pos: TypePos | None = None,
    status: StatutPos | None = None,
    dsm_id: int | None = None,
    skip: int = 0, limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return pos_crud.list_paginated(db, skip=skip, limit=limit, partner_id=partner_id,
                                    type_pos=type_pos, status=status, dsm_id=dsm_id)


@router.get("/enriched", response_model=Page[POSOutEnriched])
def list_pos_enriched(
    partner_id: int = Depends(get_partner_context),
    type_pos: TypePos | None = None,
    status: StatutPos | None = None,
    dsm_id: int | None = None,
    skip: int = 0, limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Liste des POS enrichie avec les données métier (loading, sell-out, recettes)."""
    # Requête principale pour les POS
    query = db.query(POS).filter(POS.partner_id == partner_id)
    
    if type_pos:
        query = query.filter(POS.type_pos == type_pos)
    if status:
        query = query.filter(POS.status == status)
    if dsm_id:
        query = query.filter(POS.dsm_id == dsm_id)
    
    # Pagination
    total = query.count()
    pos_list = query.offset(skip).limit(limit).all()
    
    # Enrichir chaque POS avec les données métier
    enriched_pos = []
    for pos in pos_list:
        # Loading: nombre de SIM en stock pour ce POS
        loading = db.query(func.count(SIM.id)).filter(
            SIM.pos_id == pos.id,
            SIM.status == StatutSim.EN_STOCK
        ).scalar() or 0
        
        # Sell-out: nombre de mouvements de type VENTE ou ACTIVATION pour ce POS
        sell_out = db.query(func.count(SIMMovement.id)).join(
            SIM, SIMMovement.sim_id == SIM.id
        ).filter(
            SIM.pos_id == pos.id,
            SIMMovement.movement_type.in_(["VENTE", "ACTIVATION"])
        ).scalar() or 0
        
        # Recettes: somme des primes validées/payées pour ce POS
        recettes = db.query(func.coalesce(func.sum(Prime.montant), 0)).filter(
            Prime.pos_id == pos.id,
            Prime.status.in_([StatutPrime.VALIDEE, StatutPrime.PAYEE])
        ).scalar() or 0
        
        # Zoning
        try:
            zoning = get_pos_zoning(db, pos)
        except Exception:
            zoning = {"status": "INCONNU", "color": "gray", "micro_zone": None, "partner_name": None, "detail": ""}

        # Créer l'objet enrichi
        pos_dict = POSOut.model_validate(pos).model_dump()
        pos_dict["loading"] = loading
        pos_dict["sell_out"] = sell_out
        pos_dict["recettes"] = float(recettes)
        pos_dict["zoning"] = zoning
        enriched_pos.append(pos_dict)
    
    return {
        "items": enriched_pos,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_next": skip + len(enriched_pos) < total,
    }


@router.get("/zoning/preview")
def zoning_preview(
    partner_id: int = Depends(get_partner_context),
    dsm_id: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    zone: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Prévisualisation zoning pour des coordonnées de saisie (avant création)."""
    if latitude is None or longitude is None:
        return {"status": "INCONNU", "color": "gray", "micro_zone": None, "partner_name": None, "detail": "Coordonnées manquantes"}
    return get_zoning_for_coords(db, partner_id, dsm_id, latitude, longitude, zone)


@router.get("/stats/linkage")
def pos_linkage_stats(
    partner_id: int = Depends(get_partner_context),
    dsm_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Statistiques de linkage POS pour le partenaire ou un DSM spécifique."""
    return get_pos_linkage_stats(db, partner_id, dsm_id)


@router.get("/stats/types")
def pos_type_stats(
    partner_id: int = Depends(get_partner_context),
    dsm_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Compteurs par type de POS (NOUVEAU/RECONDUIT) pour le partenaire ou un DSM."""
    return get_pos_type_counts(db, partner_id, dsm_id)


@router.post("", response_model=POSOut, status_code=201)
def create_pos_route(
    payload: POSCreate,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return create_pos(db, partner_id=partner_id, user_id=user.id, data=payload.model_dump())


@router.get("/{pos_id}/zoning")
def get_zoning(pos_id: int, partner_id: int = Depends(get_partner_context),
               db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Zoning VERT/ORANGE/ROUGE pour un POS existant."""
    pos = get_pos_in_partner(db, partner_id, pos_id)
    return get_pos_zoning(db, pos)


@router.get("/{pos_id}", response_model=POSOut)
def get_pos(pos_id: int, partner_id: int = Depends(get_partner_context),
            db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return get_pos_in_partner(db, partner_id, pos_id)


@router.patch("/{pos_id}", response_model=POSOut)
def update_pos(pos_id: int, payload: POSUpdate, partner_id: int = Depends(get_partner_context),
               db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    pos = get_pos_in_partner(db, partner_id, pos_id)
    return pos_crud.update(db, pos, payload.model_dump(exclude_unset=True))


@router.post("/{pos_id}/reconduction", response_model=ReconductionOut, status_code=201)
def reconduction_route(pos_id: int, payload: ReconductionCreate,
                        partner_id: int = Depends(get_partner_context),
                        db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _pos, reconduction = reconduire_pos(
        db, partner_id=partner_id, user_id=user.id, pos_id=pos_id, data=payload.model_dump()
    )
    return reconduction


@router.get("/{pos_id}/reconductions", response_model=Page[ReconductionOut])
def list_reconductions(pos_id: int, partner_id: int = Depends(get_partner_context),
                       skip: int = 0, limit: int = Query(default=100, le=500),
                       db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Historique des reconductions d'un POS du Partenaire courant.

    Verifie d'abord que le POS appartient bien au PartnerContext (leve 404
    sinon), puis renvoie l'historique pagine de la table `reconductions`
    (ancienne/nouvelle date d'expiration, motif, validateur, horodatage).
    """
    get_pos_in_partner(db, partner_id, pos_id)
    return reconduction_crud.list_paginated(db, skip=skip, limit=limit, pos_id=pos_id)


@router.get("/{pos_id}/link", response_model=POSLinkOut)
def get_pos_link(pos_id: int, partner_id: int = Depends(get_partner_context),
                 db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Etat des liens Utilisateur <-> POS : detenteur courant + associations UserPOS."""
    return lister_liens(db, partner_id=partner_id, pos_id=pos_id)


@router.post("/{pos_id}/link", response_model=POSLinkOut, status_code=201)
def link_pos_route(pos_id: int, payload: POSLinkCreate,
                   partner_id: int = Depends(get_partner_context),
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Link : designe un utilisateur detenteur du POS (holder_user_id + UserPOS)."""
    lier_detenteur(db, partner_id=partner_id, actor_id=user.id,
                   pos_id=pos_id, target_user_id=payload.user_id)
    return lister_liens(db, partner_id=partner_id, pos_id=pos_id)


@router.post("/{pos_id}/unlink", response_model=POSLinkOut)
def unlink_pos_route(pos_id: int, payload: POSUnlinkCreate,
                     partner_id: int = Depends(get_partner_context),
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Unlink : retire le lien Utilisateur <-> POS (tout, ou l'utilisateur cible)."""
    delier_detenteur(db, partner_id=partner_id, actor_id=user.id,
                     pos_id=pos_id, target_user_id=payload.user_id)
    return lister_liens(db, partner_id=partner_id, pos_id=pos_id)
