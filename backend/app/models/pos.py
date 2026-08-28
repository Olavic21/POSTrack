"""POS (Point de Vente) : unite commerciale centrale, cycle Nouveau/Reconduit."""
import enum
from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Date, Enum as SAEnum,
    UniqueConstraint, Index, JSON, Float,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TypePos(str, enum.Enum):
    NOUVEAU = "NOUVEAU"
    RECONDUIT = "RECONDUIT"


class StatutPos(str, enum.Enum):
    ACTIF = "ACTIF"
    SUSPENDU = "SUSPENDU"
    FERME = "FERME"


class LinkageStatus(str, enum.Enum):
    """Statut de linkage déduit de holder_user_id (pas de champ explicite)."""
    LINKED = "LINKED"      # POS avec holder_user_id
    UNLINKED = "UNLINKED"  # POS sans holder_user_id


class POS(Base):
    __tablename__ = "pos"
    __table_args__ = (
        # Unicite du code_pos dans le perimetre du Partenaire (section
        # 1.6.1 du cahier des charges) -- appliquee au niveau base, pas
        # seulement verifiee cote application, pour eliminer toute
        # fenetre de race condition entre deux creations concurrentes.
        UniqueConstraint("partner_id", "code_pos", name="uq_pos_partner_code"),
        # Index composites pour les filtres les plus frequents du
        # Dashboard et du module POS (cahier des charges section 11 :
        # p95 < 500ms sur un jeu de 10 000 POS).
        Index("ix_pos_partner_type", "partner_id", "type_pos"),
        Index("ix_pos_partner_status", "partner_id", "status"),
        Index("ix_pos_partner_expiration", "partner_id", "date_expiration"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code_pos = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    zone = Column(String(150), nullable=True)
    # Coordonnees GPS decimales (WGS84) : Float pour conserver les
    # decimales essentielles a la cartographie (un Integer arrondirait
    # 4.0512 -> 4 soit ~110 km d'erreur).
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)
    dsm_id = Column(Integer, ForeignKey("dsm.id"), nullable=False, index=True)
    holder_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    type_pos = Column(SAEnum(TypePos), nullable=False, default=TypePos.NOUVEAU)
    status = Column(SAEnum(StatutPos), nullable=False, default=StatutPos.ACTIF)

    # Stock SIM concerne au POS : stock_initial est fixe une fois (valeur
    # de depart), stock_actuel est mutable et decremente en continu par
    # sim_service a chaque creation/reconduction de SIM (section 3.6).
    stock_initial = Column(Integer, nullable=False, default=0, server_default="0")
    stock_actuel = Column(Integer, nullable=False, default=0, server_default="0")

    # --- Champs etendus pour imports reels ---
    # Identifiant organisationnel externe (systeme source du partenaire).
    org_id = Column(String(50), nullable=True, index=True)
    # Code de couleur / microzone (ex. LT3, LT4, LT5…).
    color_code = Column(String(20), nullable=True)
    # Solde SIM actuel du POS dans le systeme source (import stock).
    sim_balance = Column(Float, nullable=True)

    # Colonnes additionnelles dynamiques definies par l'ADMIN avant un
    # import Excel (section 3.10) : stockage JSON generique.
    donnees_additionnelles = Column(JSON, nullable=True)

    date_creation = Column(Date, nullable=False)
    date_expiration = Column(Date, nullable=False)
    date_derniere_reconduction = Column(Date, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    partner = relationship("Partner")
    dsm = relationship("DSM")
    holder = relationship("User", foreign_keys=[holder_user_id])
    reconductions = relationship("Reconduction", back_populates="pos", cascade="all, delete-orphan")
    primes = relationship("Prime", back_populates="pos", cascade="all, delete-orphan")

    @property
    def linkage_status(self) -> LinkageStatus:
        """Déduit le statut de linkage à partir de holder_user_id."""
        return LinkageStatus.LINKED if self.holder_user_id else LinkageStatus.UNLINKED
