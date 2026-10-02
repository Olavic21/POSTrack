"""Zoning service — VERT / ORANGE / ROUGE basé sur données géographiques réelles.

Règles :
- VERT  : POS dans la micro-zone du DSM (point dans polygon de la MZ du DSM)
- ORANGE: POS hors MZ du DSM mais dans territoire du partenaire → afficher MZ trouvée
- ROUGE : POS hors territoire du partenaire → afficher partenaire dont territoire contient le point

Aucune valeur en dur : tout est dérivé de Partner.territory_geojson et MicroZone.boundaries.
Fallback si pas de polygone : distance au centre de la MZ (< seuil) puis comparaison zone string.
"""
from sqlalchemy.orm import Session

from app.models.partner import Partner, MicroZone
from app.models.pos import POS
from app.models.dsm import DSM


def _point_in_polygon(lat: float, lon: float, polygon: list) -> bool:
    """Ray casting. polygon = GeoJSON coordinates [[[lon,lat],...]] ou [[lon,lat],...]."""
    if not polygon:
        return False
    # GeoJSON Polygon coordinates = [[[lon,lat],...]] ; ring = outer
    try:
        ring = polygon[0] if isinstance(polygon[0][0], list) else polygon
    except Exception:
        return False
    # Need at least 3 distinct points (closed ring => 4)
    if len(ring) < 4:
        return False
    x, y = lon, lat
    inside = False
    n = len(ring)
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        # Check if point is on edge (tolerance)
        # Ray casting
        if ((y1 > y) != (y2 > y)):
            xinters = (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1
            if x <= xinters:
                inside = not inside
    return inside


def _get_polygon_coords(geojson) -> list | None:
    """Extrait les coordinates d'un GeoJSON Polygon/MultiPolygon."""
    if not geojson:
        return None
    if isinstance(geojson, dict):
        t = geojson.get("type")
        coords = geojson.get("coordinates")
        if t == "Polygon" and coords:
            return coords
        if t == "MultiPolygon" and coords:
            # Retourne le premier polygone
            return coords[0] if coords else None
    if isinstance(geojson, list):
        return geojson
    return None


def _find_microzone_for_point(db: Session, partner_id: int, lat: float, lon: float) -> MicroZone | None:
    """Trouve la micro-zone dont le polygone contient le point."""
    mzs = db.query(MicroZone).filter(MicroZone.partner_id == partner_id).all()
    for mz in mzs:
        poly = _get_polygon_coords(mz.boundaries)
        if poly and _point_in_polygon(lat, lon, poly):
            return mz
    return None


def _find_partner_for_point(db: Session, lat: float, lon: float, exclude_partner_id: int | None = None) -> Partner | None:
    """Trouve le partenaire dont le territory_geojson contient le point."""
    q = db.query(Partner)
    if exclude_partner_id:
        q = q.filter(Partner.id != exclude_partner_id)
    for p in q.all():
        poly = _get_polygon_coords(p.territory_geojson)
        if poly and _point_in_polygon(lat, lon, poly):
            return p
    return None


def _is_in_territory(partner: Partner, lat: float, lon: float) -> bool:
    poly = _get_polygon_coords(partner.territory_geojson)
    if poly:
        return _point_in_polygon(lat, lon, poly)
    # Si pas de polygone territoire, on considère que tout point est dans le territoire
    # si au moins une micro-zone existe (territoire non défini = pas de check rouge possible)
    return False


def _dsm_microzone(db: Session, dsm: DSM | None) -> MicroZone | None:
    """Micro-zone associée au DSM (match zone string -> MZ name/code)."""
    if not dsm or not dsm.zone:
        return None
    # Chercher MZ du même partenaire dont name/code correspond à DSM.zone
    mz = db.query(MicroZone).filter(
        MicroZone.partner_id == dsm.partner_id,
        (MicroZone.name == dsm.zone) | (MicroZone.code == dsm.zone)
    ).first()
    return mz


def get_pos_zoning(db: Session, pos: POS) -> dict:
    """Calcule le statut zoning d'un POS existant.

    Retourne: { status: VERT|ORANGE|ROUGE|INCONNU, micro_zone, partner_name, detail }
    """
    if pos.latitude is None or pos.longitude is None:
        return {
            "status": "INCONNU",
            "color": "gray",
            "micro_zone": None,
            "partner_name": None,
            "detail": "Coordonnées GPS non renseignées",
        }

    lat, lon = float(pos.latitude), float(pos.longitude)
    partner = db.query(Partner).filter(Partner.id == pos.partner_id).first()
    dsm = db.query(DSM).filter(DSM.id == pos.dsm_id).first() if pos.dsm_id else None
    dsm_mz = _dsm_microzone(db, dsm)

    # 1. Vérifier si dans la MZ du DSM → VERT
    if dsm_mz and dsm_mz.boundaries:
        poly = _get_polygon_coords(dsm_mz.boundaries)
        if poly and _point_in_polygon(lat, lon, poly):
            return {
                "status": "VERT",
                "color": "green",
                "micro_zone": dsm_mz.name,
                "partner_name": partner.name if partner else None,
                "detail": f"Dans la micro-zone du DSM ({dsm_mz.name})",
            }
    elif dsm_mz and dsm_mz.latitude is not None and dsm_mz.longitude is not None:
        # Fallback distance si pas de polygone mais centre défini
        d2 = (dsm_mz.latitude - lat) ** 2 + (dsm_mz.longitude - lon) ** 2
        # ~0.05° ≈ 5km (approximation)
        if d2 < 0.05 ** 2:
            return {
                "status": "VERT",
                "color": "green",
                "micro_zone": dsm_mz.name,
                "partner_name": partner.name if partner else None,
                "detail": f"Proche de la micro-zone du DSM ({dsm_mz.name})",
            }

    # Fallback zone string exact match
    if pos.zone and dsm and pos.zone == dsm.zone:
        return {
            "status": "VERT",
            "color": "green",
            "micro_zone": pos.zone,
            "partner_name": partner.name if partner else None,
            "detail": f"Zone POS ({pos.zone}) = zone DSM",
        }

    # 2. Vérifier si dans une autre MZ du même partenaire → ORANGE
    other_mz = _find_microzone_for_point(db, pos.partner_id, lat, lon)
    if other_mz:
        return {
            "status": "ORANGE",
            "color": "orange",
            "micro_zone": other_mz.name,
            "partner_name": partner.name if partner else None,
            "detail": f"Hors MZ du DSM, dans {other_mz.name} du même territoire",
        }

    # Vérifier si dans le territoire partenaire (sans MZ précise) → ORANGE
    if partner and partner.territory_geojson:
        if _is_in_territory(partner, lat, lon):
            return {
                "status": "ORANGE",
                "color": "orange",
                "micro_zone": None,
                "partner_name": partner.name,
                "detail": "Dans le territoire du partenaire, hors micro-zone DSM",
            }

    # Si pas de polygone territoire mais au moins des MZ définies sans match → ORANGE par défaut
    # (on ne peut pas conclure ROUGE sans polygone)
    if partner and not partner.territory_geojson:
        mzs = db.query(MicroZone).filter(MicroZone.partner_id == pos.partner_id).all()
        if mzs:
            # Sans géométrie territoire, on considère ORANGE si hors MZ DSM
            return {
                "status": "ORANGE",
                "color": "orange",
                "micro_zone": None,
                "partner_name": partner.name if partner else None,
                "detail": "Hors micro-zone DSM, dans le territoire (géométrie territoire non définie)",
            }

    # 3. Hors territoire → ROUGE : chercher partenaire dont territoire contient le point
    other_partner = _find_partner_for_point(db, lat, lon, exclude_partner_id=pos.partner_id)
    if other_partner:
        return {
            "status": "ROUGE",
            "color": "red",
            "micro_zone": None,
            "partner_name": other_partner.name,
            "detail": f"Hors territoire — dans le territoire de {other_partner.name}",
        }

    return {
        "status": "ROUGE",
        "color": "red",
        "micro_zone": None,
        "partner_name": None,
        "detail": "Hors territoire du partenaire",
    }


def get_zoning_for_coords(db: Session, partner_id: int, dsm_id: int | None, lat: float, lon: float, zone_str: str | None = None) -> dict:
    """Calcule le zoning pour des coordonnées arbitraires (saisie POS en cours)."""
    # Créer un POS temporaire pour réutiliser la logique
    tmp = POS(partner_id=partner_id, dsm_id=dsm_id, latitude=lat, longitude=lon, zone=zone_str)
    return get_pos_zoning(db, tmp)
