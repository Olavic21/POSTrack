"""Gestion des BTS et de leurs releves periodiques."""
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationErrorApp
from app.crud.bts_crud import bts_crud, bts_releve_crud
from app.models.bts import BTS
from app.services import audit_service


def create_bts(db: Session, *, partner_id: int, user_id: int, data: dict) -> BTS:
    """
    Cree une BTS dans le Partenaire courant. Verifie l'unicite de
    code_bts au niveau applicatif (message d'erreur explicite) en plus
    de la contrainte d'unicite en base (garde-fou contre toute
    concurrence -- deux creations simultanees avec le meme code_bts).
    """
    existing = db.query(BTS).filter(BTS.partner_id == partner_id, BTS.code_bts == data["code_bts"]).first()
    if existing:
        raise ConflictError(
            f"Le code BTS '{data['code_bts']}' existe deja pour ce Partenaire.", field="code_bts",
        )
    bts = bts_crud.create(db, {**data, "partner_id": partner_id})
    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id, action="BTS_CREATE",
        entity_type="BTS", entity_id=bts.id,
    )
    return bts


def get_bts_in_partner(db: Session, partner_id: int, bts_id: int) -> BTS:
    bts = bts_crud.get(db, bts_id)
    if not bts or bts.partner_id != partner_id:
        raise NotFoundError("BTS introuvable dans ce Partenaire.")
    return bts


def add_releve(db: Session, *, partner_id: int, user_id: int, bts_id: int, data: dict):
    bts = get_bts_in_partner(db, partner_id, bts_id)

    for champ in ("charge", "taux_saturation", "rendement"):
        val = data.get(champ)
        if val is not None and val < 0:
            raise ValidationErrorApp(f"La valeur de '{champ}' ne peut pas etre negative.", field=champ)

    releve = bts_releve_crud.create(db, {**data, "bts_id": bts.id})

    audit_service.log_action(
        db, user_id=user_id, partner_id=partner_id, action="BTS_RELEVE_CREATE",
        entity_type="BTS", entity_id=bts.id,
        details=f"Nouveau releve pour {bts.code_bts}",
    )
    return releve


def get_bts_etat(taux_saturation: float | None) -> str:
    """Retourne l'état métier BTS à partir du taux de saturation.
    Seuils configurables via app.core.config.settings.
    """
    from app.core.config import settings

    if taux_saturation is None:
        return "Normal"
    if taux_saturation >= settings.BTS_SATURATION_THRESHOLD:
        return "Saturé"
    if taux_saturation >= settings.BTS_ALMOST_SATURATED_THRESHOLD:
        return "Presque saturé"
    return "Normal"
