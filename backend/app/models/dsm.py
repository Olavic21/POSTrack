"""DSM (District Sales Manager) : superviseur regional/local des POS.

Champs etendus pour l'import de donnees reels (ex. fichier STOCK ODI) :
- org_id : identifiant organizationnel externe (numeros du systeme source)
- color_code : code de couleur/microzone (ex. LT3, LT4, LT5...)
- sim_balance : solde SIM actuel du DSM dans le systeme source
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class DSM(Base):
    __tablename__ = "dsm"

    id = Column(Integer, primary_key=True, index=True)
    matricule = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    zone = Column(String(150), nullable=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)

    # --- Champs etendus pour imports reels ---
    # Identifiant organisationnel externe (systeme source du partenaire).
    org_id = Column(String(50), nullable=True, index=True)
    # Code de couleur / microzone (ex. LT3, LT4, LT5…).
    color_code = Column(String(20), nullable=True)
    # Solde SIM actuel du DSM (import stock).
    sim_balance = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    partner = relationship("Partner")
    users = relationship("User", back_populates="dsm")
