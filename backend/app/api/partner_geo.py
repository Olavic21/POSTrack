"""Endpoint de representation geographique du territoire d'un partenaire.

GET /api/partners/{partner_id}/geo

Renvoie les donnees geographiques RELLES du partenaire, scopees sur le
PartnerContext :
  - `bts`          : points BTS avec coordonnees + zone/quartier + micro-zone
                     rattachee (proximite), operateur, saturation, statut.
  - `micro_zones`  : micro-zones declarees (avec leur polygone `boundaries`
                     si le client en a fourni ; NULL sinon).
  - `zones`        : quartiers/zones effectivement couverts, derives des
                     donnees reelles (valeurs distinctes de bts/pos.zone).
  - `territory`    : polygone GeoJSON derive de l'ENVELOPPE CONVEXE des points
                     de presence reels (POS + BTS). NULL si moins de 3 points
                     distincts. S'il s'agit de l'etendue mathematique des
                     donnees, pas d'une frontiere administrative invente
                     : si le client fournit `partners.territory_geojson`,
                     celui-ci prend la priorite.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_partner_context, get_current_user
from app.models.user import User
from app.models.partner import Partner, MicroZone
from app.models.bts import BTS
from app.models.bts_releve import BTSReleve
from app.models.pos import POS

router = APIRouter(prefix="/api/partners/{partner_id}/geo", tags=["Géographie"])


def _cross(o: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _convex_hull(points: list[tuple[float, float]]) -> list[list[float]]:
    """Enveloppe convexe (Andrew monotone chain) des coordonnees reelles.

    Filtre d'abord les points aberrants (> 2 écarts-types de la moyenne)
    pour éviter que des coordonnées erronées n'étendent le territoire
    au-delà de la zone réelle (ex: Douala pour ODI).

    Retourne un anneau [longitude, latitude] ferme (GeoJSON) ou liste vide
    si < 3 points distincts.
    """
    import math
    pts = sorted({(round(float(x), 6), round(float(y), 6)) for x, y in points})
    if len(pts) < 3:
        return []

    # Filtrer les points aberrants (outliers)
    if len(pts) > 5:
        lats = [p[0] for p in pts]
        lngs = [p[1] for p in pts]
        mean_lat = sum(lats) / len(lats)
        mean_lng = sum(lngs) / len(lngs)
        std_lat = math.sqrt(sum((l - mean_lat) ** 2 for l in lats) / len(lats)) or 1
        std_lng = math.sqrt(sum((l - mean_lng) ** 2 for l in lngs) / len(lngs)) or 1
        pts = [(lat, lng) for lat, lng in pts
               if abs(lat - mean_lat) <= 2 * std_lat and abs(lng - mean_lng) <= 2 * std_lng]

    if len(pts) < 3:
        return []

    lower: list[tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: list[tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    # Return closed ring in GeoJSON format: [longitude, latitude]
    return [[lng, lat] for lat, lng in hull] + [[hull[0][1], hull[0][0]]]


def _bts_statut(bts_id: int, last: BTSReleve | None) -> str:
    return (last.statut or "actif").lower() if last else "inconnu"


def _nearest_microzone(bts: BTS, microzones: list[MicroZone]) -> MicroZone | None:
    if bts.latitude is None or bts.longitude is None or not microzones:
        return None
    best = None
    best_d2 = 25.0 ** 2
    for mz in microzones:
        if mz.latitude is None or mz.longitude is None:
            continue
        d2 = (mz.latitude - bts.latitude) ** 2 + (mz.longitude - bts.longitude) ** 2
        if d2 <= best_d2:
            best_d2 = d2
            best = mz
    return best


@router.get("")
def geo_territoire(
    partner_id: int = Depends(get_partner_context),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        return {
            "partner_id": partner_id,
            "partner_name": None,
            "bts": [],
            "micro_zones": [],
            "zones": [],
            "territory": None,
            "territory_source": None,
            "has_geo_data": False,
        }

    microzones = (
        db.query(MicroZone).filter(MicroZone.partner_id == partner_id).order_by(MicroZone.id).all()
    )

    bts_rows = db.query(BTS).filter(BTS.partner_id == partner_id).all()
    bts_payload = []
    bts_points: list[tuple[float, float]] = []
    for bts in bts_rows:
        last = (
            db.query(BTSReleve)
            .filter(BTSReleve.bts_id == bts.id)
            .order_by(BTSReleve.date_releve.desc())
            .first()
        )
        if bts.latitude is not None and bts.longitude is not None:
            bts_points.append((float(bts.latitude), float(bts.longitude)))
        mz = _nearest_microzone(bts, microzones)
        bts_payload.append(
            {
                "id": bts.id,
                "code": bts.code_bts,
                "operateur": bts.operateur,
                "technologie": bts.technologie,
                "latitude": bts.latitude,
                "longitude": bts.longitude,
                "zone": bts.zone,
                "quartier": bts.zone,
                "micro_zone": mz.name if mz else None,
                "saturation": last.taux_saturation if last else None,
                "statut": _bts_statut(bts.id, last),
            }
        )

    micro_payload = [
        {
            "id": mz.id,
            "name": mz.name,
            "code": mz.code,
            "latitude": mz.latitude,
            "longitude": mz.longitude,
            "boundaries": mz.boundaries,
        }
        for mz in microzones
    ]

    # Collect zones from POS and BTS
    from collections import defaultdict
    zone_points: dict[str, list[tuple[float, float]]] = defaultdict(list)
    
    # From POS
    pos_rows = db.query(POS).filter(POS.partner_id == partner_id).all()
    for pos in pos_rows:
        if pos.latitude is not None and pos.longitude is not None and pos.zone:
            zone_points[pos.zone].append((float(pos.latitude), float(pos.longitude)))
    
    # From BTS
    for bts in bts_rows:
        if bts.latitude is not None and bts.longitude is not None and bts.zone:
            zone_points[bts.zone].append((float(bts.latitude), float(bts.longitude)))

    # Build zones payload with convex hull if enough points
    zones_payload = []
    for zone_name, points in zone_points.items():
        if len(points) >= 3:
            hull = _convex_hull(points)
            zones_payload.append({
                "name": zone_name,
                "point_count": len(points),
                "boundaries": {
                    "type": "Polygon",
                    "coordinates": [hull]
                }
            })
        # Note: < 3 points -> no geometry invented per requirement

    # Build territory: client-provided takes priority, else convex hull of all points
    territory = None
    territory_source = None
    
    if partner.territory_geojson:
        territory = partner.territory_geojson
        territory_source = "client"
    else:
        all_points = list(bts_points)
        for pos in pos_rows:
            if pos.latitude is not None and pos.longitude is not None:
                all_points.append((float(pos.latitude), float(pos.longitude)))
        if len(all_points) >= 3:
            territory = {"type": "Polygon", "coordinates": [_convex_hull(all_points)]}
            territory_source = "convex_hull"

    return {
        "partner_id": partner_id,
        "partner_name": partner.name,
        "bts": bts_payload,
        "micro_zones": micro_payload,
        "zones": zones_payload,
        "territory": territory,
        "territory_source": territory_source,
        "has_geo_data": bool(bts_points or any(mz.get("boundaries") for mz in micro_payload) or zone_points),
    }