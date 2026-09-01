"""Comptes utilisateurs, rôles et identité d'authentification."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.security.password import hash_password, verify_password
from app.security.permissions import Role


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    role = Column(SAEnum(Role), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def set_password(self, password: str) -> None:
        """Hash and set the password (bcrypt)."""
        self.hashed_password = hash_password(password)

    def check_password(self, password: str) -> bool:
        """Verify a plaintext password against the stored hash."""
        return verify_password(password, self.hashed_password)

    # Un OPERATIONNEL est rattaché à un seul partenaire via partner_id.
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)
    dsm_id = Column(Integer, ForeignKey("dsm.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dsm = relationship("DSM", back_populates="users")
    partner = relationship("Partner", foreign_keys=[partner_id])
    partner_links = relationship("UserPartner", back_populates="user", cascade="all, delete-orphan")
    pos_links = relationship("UserPOS", back_populates="user", cascade="all, delete-orphan")


class UserPartner(Base):
    """Association Utilisateur <-> Partenaire."""
    __tablename__ = "user_partners"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False)

    user = relationship("User", back_populates="partner_links")
    partner = relationship("Partner")


class UserPOS(Base):
    """Association Utilisateur <-> POS autorisés."""
    __tablename__ = "user_pos"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pos_id = Column(Integer, ForeignKey("pos.id"), nullable=False)

    user = relationship("User", back_populates="pos_links")
    pos = relationship("POS")