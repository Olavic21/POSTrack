"""Requetes multi-entites sous /api/partners/{partner_id}/requests."""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, get_partner_context, require_roles
from app.crud.requete_crud import requete_crud
from app.models.requete import Requete, TypeRequete
from app.models.user import User
from app.schemas.requete import RequeteCreate, RequeteUpdate, RequeteOut, RequeteSummaryPageOut
from app.schemas.pagination import Page
from app.security.permissions import Role, RECONDUCTION_ROLES
from app.services.requete_service import create_requete, get_requete_in_partner, update_requete, enrich_requete_summary, get_dsm_request_summary

router = APIRouter(prefix="/api/partners/{partner_id}/requests", tags=["Suivi des requêtes"])


TYPE_LABELS = {
    "AJOUT": "Ajout",
    "RECONDUCTION": "Reconduction",
    "DELINKAGE": "Delinkage",
    "BASCULEMENT": "Basculement",
    "AUTRE": "Autres",
}


def _normalize_day(value: datetime | None) -> str:
    if not value:
        return "—"
    return value.date().isoformat()


def _parse_iso_date(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"Format de date invalide: {value}") from exc
    return parsed


@router.get("/summary", response_model=RequeteSummaryPageOut)
def list_requests_summary(
    partner_id: int = Depends(get_partner_context),
    type_requete: str | None = None,
    date_creation_from: str | None = None,
    date_creation_to: str | None = None,
    date_fin_from: str | None = None,
    date_fin_to: str | None = None,
    dsm_id: int | None = None,  # Filtre par DSM
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = db.query(Requete).filter(Requete.partner_id == partner_id)
    if type_requete:
        query = query.filter(Requete.type_requete == TypeRequete(type_requete.upper()))
    if dsm_id:
        query = query.filter(Requete.dsm_id == dsm_id)
    if date_creation_from:
        query = query.filter(Requete.date_creation >= _parse_iso_date(date_creation_from))
    if date_creation_to:
        query = query.filter(Requete.date_creation < _parse_iso_date(date_creation_to))
    if date_fin_from:
        query = query.filter(Requete.date_finalisation >= _parse_iso_date(date_fin_from))
    if date_fin_to:
        query = query.filter(Requete.date_finalisation < _parse_iso_date(date_fin_to))

    rows = query.order_by(Requete.date_creation.desc().nullslast(), Requete.id.desc()).all()

    grouped: dict[tuple[str, str], dict] = {}
    for item in rows:
        created = _normalize_day(item.date_creation)
        type_key = item.type_requete.value if hasattr(item.type_requete, "value") else str(item.type_requete)
        type_label = TYPE_LABELS.get(type_key, type_key)
        key = (created, type_label)
        bucket = grouped.setdefault(key, {
            "date_creation": created,
            "type_requete": type_label,
            "nombre_demande": 0,
            "nombre_rejete": 0,
            "nombre_effectue": 0,
            "date_fin": None,
            "dsm_id": item.dsm_id,
            "dsm_name": None,
            "demandeur_name": None,
            "statut": None,
            "en_retard": False,
            "delai_attente": None,
        })
        bucket["nombre_demande"] += int(item.nombre_demande or 0)
        bucket["nombre_rejete"] += int(item.nombre_rejete or 0)
        bucket["nombre_effectue"] += int(item.nombre_effectue or 0)
        end_value = item.date_finalisation or item.closed_at
        if end_value and not bucket["date_fin"]:
            bucket["date_fin"] = _normalize_day(end_value)
        
        # Enrichir avec les informations calculées
        enriched = enrich_requete_summary(db, item)
        bucket["dsm_id"] = enriched.get("dsm_id")
        bucket["dsm_name"] = enriched.get("dsm_name")
        bucket["demandeur_name"] = enriched.get("demandeur_name")
        bucket["statut"] = enriched.get("statut")
        bucket["en_retard"] = enriched.get("en_retard", False)
        bucket["delai_attente"] = enriched.get("delai_attente")

    items = sorted(grouped.values(), key=lambda x: (x["date_creation"], x["type_requete"]), reverse=True)
    total = len(items)
    return {"items": items[skip:skip + limit], "total": total, "skip": skip, "limit": limit}


@router.get("", response_model=Page[RequeteOut])
def list_requests(partner_id: int = Depends(get_partner_context), type_requete: str | None = None,
                   skip: int = 0, limit: int = Query(default=100, le=500),
                   db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return requete_crud.list_paginated(db, skip=skip, limit=limit, partner_id=partner_id, type_requete=type_requete)


@router.post("", response_model=RequeteOut, status_code=201)
def create_request(payload: RequeteCreate, partner_id: int = Depends(get_partner_context),
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return create_requete(db, partner_id=partner_id, user_id=user.id, data=payload.model_dump())


@router.get("/{request_id}", response_model=RequeteOut)
def get_request(request_id: int, partner_id: int = Depends(get_partner_context),
                 db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return get_requete_in_partner(db, partner_id, request_id)


@router.patch("/{request_id}", response_model=RequeteOut)
def update_request(request_id: int, payload: RequeteUpdate,
                   partner_id: int = Depends(get_partner_context),
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return update_requete(db, partner_id=partner_id, user_id=user.id, requete_id=request_id,
                          data=payload.model_dump(exclude_unset=True))


@router.get("/dsm/{dsm_id}/summary")
def dsm_requests_summary(
    dsm_id: int,
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Résumé des requêtes spécifiques à un DSM avec indicateurs de progression."""
    return get_dsm_request_summary(db, partner_id, dsm_id)
