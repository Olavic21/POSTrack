from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud.user_crud import get_by_username, link_partner, link_pos, get_authorized_partner_ids, get_authorized_pos_ids
from app.models.user import User
from app.schemas.user_schemas import UserOut, UserCreate, UserUpdate
from app.security.password import hash_password
from app.security.permissions import Role
from app.api.deps import require_roles

router = APIRouter(prefix="/users", tags=["users"])

# Toutes les routes de gestion des utilisateurs sont réservées à l'ADMIN
# (voir ADMIN_SCREEN_ROLES dans app.security.permissions).


def _apply_partner_name(db: Session, user: User) -> User:
    """Renseigne `partner_name` pour la sérialisation UserOut."""
    from app.models.partner import Partner
    if user.partner_id is not None:
        partner = db.get(Partner, user.partner_id)
        user.partner_name = partner.name if partner else None
    else:
        user.partner_name = None
    return user


def _ensure_email_unique(db: Session, email: str, exclude_user_id: int | None = None) -> None:
    existing = db.query(User).filter(User.email == email).first()
    if existing and existing.id != exclude_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà.",
        )


@router.get("", response_model=list[UserOut])
def list_users(
    role: Role | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> list[User]:
    """Lister tous les utilisateurs (ADMIN only)."""
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    users = query.order_by(User.id).all()
    for user in users:
        _apply_partner_name(db, user)
    return users


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> User:
    """Créer un nouveau compte utilisateur (ADMIN only)."""
    # Vérifier que le username n'existe pas déjà
    if get_by_username(db, username=payload.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec ce username existe déjà.",
        )
    _ensure_email_unique(db, payload.email)

    # Créer l'utilisateur avec le mot de passe haché (bcrypt)
    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
        hashed_password=hash_password(payload.password),
        dsm_id=payload.dsm_id,
        partner_id=payload.partner_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    for pid in payload.partner_ids:
        link_partner(db, user_id=user.id, partner_id=pid)
    for posid in payload.pos_ids:
        link_pos(db, user_id=user.id, pos_id=posid)

    db.refresh(user)
    return _apply_partner_name(db, user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> User:
    """Récupérer un utilisateur par ID (ADMIN only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )
    return _apply_partner_name(db, user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> User:
    """Mettre à jour un utilisateur (ADMIN only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    data = payload.model_dump(exclude_unset=True)

    if "username" in data:
        if get_by_username(db, username=data["username"]) and data["username"] != user.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un autre utilisateur porte déjà ce username.",
            )
        user.username = data["username"]

    if "email" in data:
        _ensure_email_unique(db, data["email"], exclude_user_id=user.id)
        user.email = data["email"]

    if "full_name" in data:
        user.full_name = data["full_name"]

    if "role" in data:
        user.role = data["role"]

    if "is_active" in data:
        user.is_active = data["is_active"]

    if "dsm_id" in data:
        user.dsm_id = data["dsm_id"]

    if "partner_id" in data:
        user.partner_id = data["partner_id"]

    if "password" in data and data["password"]:
        user.hashed_password = hash_password(data["password"])

    db.add(user)
    db.commit()
    db.refresh(user)
    return _apply_partner_name(db, user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.ADMIN)),
) -> None:
    """Supprimer un utilisateur (ADMIN only). Interdit pour le compte courant."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte.",
        )
    db.delete(user)
    db.commit()
    return None


@router.post("/{user_id}/link-partner", response_model=UserOut)
def link_user_to_partner(
    user_id: int,
    *,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
    partner_id: int,
) -> User:
    """Lier un utilisateur à un partenaire (ADMIN only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )
    link_partner(db, user_id=user.id, partner_id=partner_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _apply_partner_name(db, user)


@router.post("/{user_id}/link-pos", response_model=UserOut)
def link_user_to_pos(
    user_id: int,
    *,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
    pos_id: int,
) -> User:
    """Lier un utilisateur à un POS (ADMIN only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )
    link_pos(db, user_id=user.id, pos_id=pos_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _apply_partner_name(db, user)


@router.get("/{user_id}/authorized-partners", response_model=list[int])
def get_authorized_partners_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> list[int]:
    """Récupérer les partner_id autorisés pour un utilisateur (ADMIN only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )
    return get_authorized_partner_ids(db, user)


@router.get("/{user_id}/authorized-pos", response_model=list[int])
def get_authorized_pos_endpoint(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles(Role.ADMIN)),
) -> list[int]:
    """Récupérer les pos_id autorisés pour un utilisateur (ADMIN only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )
    return get_authorized_pos_ids(db, user)