"""BTS (Base Transceiver Station) : infrastructure reseau d'un Partenaire.

Champs etendus pour l'import de donnees reels (ex. fichier ZONE ODI) :
- coverage_km2 : surface de couverture en km2
- traffic_volume_gb : volume de trafic en Go
- boundary_points : points limites de la zone de couverture (JSON)
- prominent_site : site remarquable / point de repere
- quarter : quartier / zone principale
- street : rue principale
- radius_m : rayon de couverture en metres
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BTS(Base):
    __tablename__ = "bts"
    __table_args__ = (
        # Unicite du code_bts dans le perimetre du Partenaire, au niveau
        # base (cf. meme raisonnement que POS.code_pos) : le glossaire
        # (section 1.7.1) utilise code_bts comme cle de rapprochement,
        # ce qui suppose son unicite par Partenaire.
        UniqueConstraint("partner_id", "code_bts", name="uq_bts_partner_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False, index=True)

    code_bts = Column(String(50), nullable=False, index=True)
    operateur = Column(String(100), nullable=True)
    technologie = Column(String(50), nullable=True)
    capacite_max = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    zone = Column(String(150), nullable=True)

    # --- Champs etendus pour imports reels (ZONE ODI etc.) ---
    # Surface de couverture en km2.
    coverage_km2 = Column(Float, nullable=True)
    # Volume de trafic en Go.
    traffic_volume_gb = Column(Float, nullable=True)
    # Points limites de la zone (N/E/S/W avec landmarks) : JSON array.
    boundary_points = Column(JSON, nullable=True)
    # Site remarquable / point de repere principal.
    prominent_site = Column(String(255), nullable=True)
    # Quartier / zone geographique principale.
    quarter = Column(String(150), nullable=True)
    # Rue principale.
    street = Column(String(255), nullable=True)
    # Rayon de couverture en metres.
    radius_m = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    partner = relationship("Partner")
    releves = relationship("BTSReleve", back_populates="bts", cascade="all, delete-orphan",
                            order_by="desc(BTSReleve.date_releve)")
