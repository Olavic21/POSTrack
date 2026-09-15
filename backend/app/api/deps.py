"""Dépendances FastAPI transverses : identification JWT, résolution du
rôle, et surtout get_partner_context / require_partner_access qui
centralisent le contrôle du contexte Partenaire. Les routes ne doivent
jamaais reconstruire ces vérifications individuellement.
"""
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import UnauthorizedError, ForbiddenError
from app.security.jwt import decode_token
from app.security.permissions import Role
from app.crud.user_crud import user_crud
from app.crud.revoked_token_crud import is_revoked
from app.models.user import User
from app.models.dsm import DSM
from app.models.pos import POS


def get_current_token_payload(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """
    Decode et valide le jeton d'acces courant (signature, type, non
    revocation), sans encore verifier l'utilisateur associe. Utilise par
    get_current_user, et par la route /auth/logout qui a besoin du
    'jti' pour revoquer precisement le jeton en cours.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Jeton d'authentification manquant.")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise UnauthorizedError("Jeton invalide ou expire.")
    if is_revoked(db, payload.get("jti")):
        raise UnauthorizedError("Jeton revoque (deconnexion effectuee). Veuillez vous reconnecter.")
    return payload


def get_current_user(
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
) -> User:
    user = user_crud.get(db, int(payload["sub"]))
    if not user or not user.is_active:
        raise UnauthorizedError("Compte introuvable ou desactive.")
    return user


def require_roles(*roles: Role):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ForbiddenError("Role insuffisant pour cette operation.")
        return user
    return dependency


def get_authorized_partners(db: Session, user: User) -> list[int]:
    """Renvoie la liste des partner_id auxquels l'utilisateur a acces.

    Règle de référence (isolation partenaire) :
    - ADMIN : tous les partenaires
    - MANAGER / CHEF_OPERATIONNEL : partenaires liés via user_partners (UserPartner)
      ou, à défaut, partner_id / dsm_id du user. Fallback permissif (tous les
      DSM) uniquement si aucun lien n'existe — évite de casser les comptes
      de test historiques sans user_partners, mais les nouveaux comptes DOIVENT
      être liés via user_partners pour une isolation stricte.
    - OPERATIONNEL : partner_id forcé uniquement
    """
    if user.role == Role.ADMIN:
        from app.models.partner import Partner
        return [p.id for p in db.query(Partner.id).all()]
    if user.role in (Role.MANAGER, Role.CHEF_OPERATIONNEL):
        from app.models.user import UserPartner
        linked = [r[0] for r in db.query(UserPartner.partner_id).filter(UserPartner.user_id == user.id).all()]
        if linked:
            return linked
        if user.partner_id:
            return [user.partner_id]
        if getattr(user, "dsm_id", None):
            dsm = db.query(DSM).filter(DSM.id == user.dsm_id).first()
            if dsm and dsm.partner_id:
                return [dsm.partner_id]
        # Fallback historique (permissif) — conservé pour ne pas casser les
        # comptes seed sans user_partners ; à terme, exiger un lien explicite.
        return [p[0] for p in db.query(DSM.partner_id).distinct().all()]
    if user.role == Role.OPERATIONNEL:
        return [user.partner_id] if user.partner_id else []
    return []


def get_partner_context(
    partner_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> int:
    """
    Dependance a utiliser sur toute route /api/partners/{partner_id}/...
    Verifie que l'utilisateur connecte a effectivement acces a ce
    Partenaire ; leve 403 sinon. Retourne le partner_id valide.
    """
    if user.role == Role.OPERATIONNEL:
        forced_partner = user.partner_id
        if not forced_partner:
            raise ForbiddenError("Compte OPERATIONNEL sans partenaire rattaché.")
        if partner_id != forced_partner:
            raise ForbiddenError("Acces refuse : un OPERATIONNEL ne peut pas changer de Partenaire.")
        return forced_partner
    authorized = get_authorized_partners(db, user)
    if user.role != Role.ADMIN and partner_id not in authorized:
        raise ForbiddenError("Acces refuse : ce Partenaire n'est pas dans votre perimetre.")
    return partner_id
