"""Partenaire : racine du contexte de donnees (PartnerContext).

La classe Partner porte les informations d'identite demandees par le
client (responsable, commercial, numero MasterSIM) et pointe vers ses
micro-zones geographiques (table `micro_zones`).
"""
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Float, ForeignKey, Date, JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Partner(Base):
    __tablename__ = "partners"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # --- Identite partenaire (carte d'identite, etape 2) -----------------
    # Responsable (nom / contact / lien vers un compte utilisateur).
    responsable_name = Column(String(150), nullable=True)
    responsable_contact = Column(String(150), nullable=True)
    responsable_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Commercial en charge du dossier (nom / contact / lien utilisateur).
    commercial_name = Column(String(150), nullable=True)
    commercial_contact = Column(String(150), nullable=True)
    commercial_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Numero MasterSIM (carte SIM "maitresse" / compte de reference).
    master_sim_number = Column(String(50), nullable=True)

    # Debut du contrat de distribution (carte d'identite partenaire).
    contract_start_date = Column(Date, nullable=True)

    # Référence vers un fichier interne sécurisé d'import BTS.
    # Le contenu brut ne doit pas être exposé ni journalisé.
    bts_import_file_path = Column(String(500), nullable=True)

    # Perimetre global du partenaire (polygone GeoJSON) fourni par le client.
    # NULL tant qu'aucune geometrie n'est communiquee.
    territory_geojson = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relations
    responsable = relationship("User", foreign_keys=[responsable_user_id])
    commercial = relationship("User", foreign_keys=[commercial_user_id])
    micro_zones = relationship(
        "MicroZone", back_populates="partner", cascade="all, delete-orphan",
        order_by="MicroZone.id",
    )
    sales_targets = relationship(
        "PartnerSalesTarget", back_populates="partner", cascade="all, delete-orphan",
        order_by="PartnerSalesTarget.id",
    )


class MicroZone(Base):
    """Micro-zone geographique rattachee a un Partenaire.

    Un Partenaire est decoupe en micro-zones (quartiers / zones de
    couverture) ; chaque POS/DSM est ensuite associe a une micro-zone.
    Le nombre de micro-zones d'un Partenaire se lit via cette relation.
    """
    __tablename__ = "micro_zones"

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    # Perimetre reel de la micro-zone (polygone GeoJSON) fourni par le client.
    # NULL tant qu'aucune geometrie n'est communiquee ; aucune forme n'est
    # estimee cote serveur.
    boundaries = Column(JSON, nullable=True)

    # Coefficient de potentiel de la micro-zone (utilise pour la
    # repartition automatique des objectifs DSM — systeme de primes).
    # Ex: zone a fort potentiel = 1.20, zone modeste = 0.80.
    potential_coefficient = Column(Float, nullable=False, default=1.0, server_default="1.0")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    partner = relationship("Partner", back_populates="micro_zones")


class PartnerSalesTarget(Base):
    """Objectifs mensuels persistés du suivi des ventes d'un partenaire."""
    __tablename__ = "partner_sales_targets"

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(Date, nullable=False, index=True)

    creation_target = Column(Integer, nullable=True)
    redeployment_target = Column(Integer, nullable=True)
    sell_out_target = Column(Integer, nullable=True)
    loading_target = Column(Integer, nullable=True)
    revenue_target = Column(Integer, nullable=True)  # Objectif global de vente (recettes) - donnée manquante identifiée

    creation_stock_initial = Column(Integer, nullable=True)
    redeployment_stock_initial = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    partner = relationship("Partner", back_populates="sales_targets")
