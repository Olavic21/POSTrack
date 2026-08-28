"""
odi_import_service : Import de donnees reels pour un Partenaire a partir
de fichiers Excel specifiques (format STOCK + format ZONE).

Ces formats sont propres aux partenaires reels et different du format
standardise de l'import Excel existant. Le service detecte
automatiquement le format du fichier et route vers le parser adequat.

Formats supportes :
- ZONE : fichier geographique avec BTS, bornes N/E/S/W, GPS, couverture
- STOCK : fichier hierarchique DSM->POS avec solde SIM et codes couleur

Usage typique :
    from app.services.odi_import_service import import_zone_file, import_stock_file

    result = import_zone_file(db, partner_id=42, file_bytes=zone_xlsx)
    result = import_stock_file(db, partner_id=42, file_bytes=stock_xlsx)
"""
import io
import re
from datetime import date

import pandas as pd
from sqlalchemy.orm import Session

from app.core.errors import ValidationErrorApp
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.pos import POS, TypePos, StatutPos
from app.models.bts import BTS


# --- Helpers ---

def _is_blank(value) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        return False
    return str(value).strip() == ""


def _clean_str(value, default: str = "") -> str:
    return default if _is_blank(value) else str(value).strip()


def _parse_gps(value):
    """Parse une coordonnee GPS depuis des formats varies (espace, virgule, etc.)."""
    if _is_blank(value):
        return None
    s = str(value).strip()
    # Essayer split par virgule d'abord, puis par espace
    for sep in [",", " "]:
        parts = [p.strip() for p in s.split(sep) if p.strip()]
        if len(parts) == 2:
            try:
                lat = float(parts[0])
                lon = float(parts[1])
                if 0 < lat < 10 and 0 < lon < 15:  # Validation basique zone Cameroun
                    return (lat, lon)
            except ValueError:
                continue
    # Dernier essai : tout le bloc comme float
    return None


def _parse_capacity(value):
    """Parse la capacite depuis '2700 Channels' ou '700 Channels'."""
    if _is_blank(value):
        return None
    s = str(value).strip()
    m = re.search(r"([\d\s]+)", s.replace(" ", ""))
    if m:
        try:
            return float(m.group(1).replace(" ", ""))
        except ValueError:
            return None
    return None


def _parse_radius(value):
    """Parse le rayon depuis '734m', '1Km', etc."""
    if _is_blank(value):
        return None
    s = str(value).strip().lower()
    m = re.search(r"([\d.]+)\s*(m|km)", s)
    if m:
        val = float(m.group(1))
        unit = m.group(2)
        if unit == "km":
            val *= 1000
        return val
    return None


# --- ZONE import ---

def import_zone_file(db: Session, *, partner_id: int, file_bytes: bytes) -> dict:
    """Importe un fichier ZONE Excel (format ODI) et cree/met a jour les BTS.

    Format attendu :
    - Colonnes : SN, PARTNERS, BTS CODE NAME, PROMINENT SITES, BOUNDARIES,
      QUARTER, STREET, RADIUS, GPS COORDINATES, COVERAGE (Km2),
      CAPACITY, TRAFFIC VOLUME(GB), POS
    - Chaque BTS a 4 lignes (N/E/S/W boundary) + 1 ligne principale avec GPS

    Returns :
        dict avec les compteurs d'operations effectuees
    """
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValidationErrorApp(f"Fichier ZONE illisible : {exc}")

    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise ValidationErrorApp("Partenaire introuvable.")

    # Filtrer les lignes de donnees (exclure les lignes RECAP/summary en fin)
    df = df[~df["BTS CODE NAME"].astype(str).str.contains("RECAP|COVERAGE|No\\. OF", case=False, na=False)]
    df = df[~df["SN"].astype(str).str.contains("RECAP|No", case=False, na=False)]

    created_bts = 0
    updated_bts = 0
    errors = []

    # Regrouper par BTS code : chaque BTS a 1+ lignes (N, E, S, W boundaries)
    current_bts_code = None
    bts_data = {}  # code -> {main_data, boundaries: []}

    for _, row in df.iterrows():
        bts_code = _clean_str(row.get("BTS CODE NAME"))

        if bts_code:
            # Ligne principale d'une BTS
            if current_bts_code and current_bts_code in bts_data:
                pass  # Sauvegarder la BTS precedente (traitee ci-dessous)

            current_bts_code = bts_code
            if bts_code not in bts_data:
                bts_data[bts_code] = {
                    "prominent_site": _clean_str(row.get("PROMINENT SITES")),
                    "quarter": _clean_str(row.get("QUARTER")),
                    "street": _clean_str(row.get("STREET")),
                    "radius_m": _parse_radius(row.get("RADIUS")),
                    "coverage_km2": None,
                    "capacity": None,
                    "traffic_volume": None,
                    "lat": None,
                    "lon": None,
                    "boundaries": [],
                }

            # Mettre a jour les donnees principales (seulement si non-blank)
            gps = _parse_gps(row.get("GPS COORDINATES"))
            if gps:
                bts_data[bts_code]["lat"] = gps[0]
                bts_data[bts_code]["lon"] = gps[1]

            cov = _clean_str(row.get("COVERAGE (Km\u00b2)"))
            if cov:
                try:
                    bts_data[bts_code]["coverage_km2"] = float(cov)
                except ValueError:
                    pass

            cap = _parse_capacity(row.get("CAPACITY"))
            if cap:
                bts_data[bts_code]["capacity"] = cap

            traffic = _clean_str(row.get("TRAFFIC VOLUME(GB)"))
            if traffic and traffic.lower() != "no data":
                try:
                    bts_data[bts_code]["traffic_volume"] = float(traffic)
                except ValueError:
                    pass

        # Boundary point (ligne N/E/S/W)
        boundary = _clean_str(row.get("BOUNDARIES"))
        if current_bts_code and current_bts_code in bts_data and boundary:
            direction = boundary.split("=")[0].strip() if "=" in boundary else ""
            landmark = boundary.split("=", 1)[1].strip() if "=" in boundary else boundary
            bts_data[current_bts_code]["boundaries"].append({
                "direction": direction,
                "landmark": landmark,
                "quarter": _clean_str(row.get("QUARTER")),
                "street": _clean_str(row.get("STREET")),
                "radius_m": _parse_radius(row.get("RADIUS")),
            })

    # Ecrire en base
    for bts_code, data in bts_data.items():
        if not bts_code or bts_code.lower() in ("coverage (km\u00b2)", "capacity", "traffic volume(gb)"):
            continue

        try:
            existing = db.query(BTS).filter(
                BTS.partner_id == partner_id, BTS.code_bts == bts_code
            ).first()

            update_fields = {
                "prominent_site": data["prominent_site"] or None,
                "quarter": data["quarter"] or None,
                "street": data["street"] or None,
                "radius_m": data["radius_m"],
                "coverage_km2": data["coverage_km2"],
                "traffic_volume_gb": data["traffic_volume"],
                "boundary_points": data["boundaries"] if data["boundaries"] else None,
            }
            if data["lat"] is not None:
                update_fields["latitude"] = data["lat"]
            if data["lon"] is not None:
                update_fields["longitude"] = data["lon"]
            if data["capacity"] is not None:
                update_fields["capacite_max"] = data["capacity"]

            if existing:
                for k, v in update_fields.items():
                    if v is not None:
                        setattr(existing, k, v)
                db.add(existing)
                updated_bts += 1
            else:
                bts = BTS(
                    partner_id=partner_id,
                    code_bts=bts_code,
                    **{k: v for k, v in update_fields.items() if v is not None},
                )
                db.add(bts)
                created_bts += 1
        except Exception as exc:
            errors.append({"bts_code": bts_code, "error": str(exc)})

    db.commit()

    return {
        "partner_id": partner_id,
        "format": "ZONE",
        "total_bts": len(bts_data),
        "created": created_bts,
        "updated": updated_bts,
        "errors": errors,
    }


# --- STOCK import ---

def import_stock_file(db: Session, *, partner_id: int, file_bytes: bytes) -> dict:
    """Importe un fichier STOCK Excel (format hierarchique ODI) et cree/met a jour
    les DSM et POS avec org_id, color_code, sim_balance.

    Format attendu :
    - Niveau 4 : Ligne maitre du partenaire/zone
    - Niveau 5 : DSM (col3=code DSM, col4=zone type, balance=solde SIM)
    - Niveau 6 : POS (col2=code POS, col3=parent DSM, col4=zone type, balance=solde)
    - Colonnes : Level, Organization Name, Unnamed:2 (code), Unnamed:3 (parent/zone_type),
      Unnamed:4 (zone_type), ..., Parent Organization Name, Current Balance

    Returns :
        dict avec les compteurs d'operations effectuees
    """
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
        df.columns = [c.strip() for c in df.columns]
    except Exception as exc:
        raise ValidationErrorApp(f"Fichier STOCK illisible : {exc}")

    partner = db.query(Partner).filter(Partner.id == partner_id).first()
    if not partner:
        raise ValidationErrorApp("Partenaire introuvable.")

    created_dsm = 0
    updated_dsm = 0
    created_pos = 0
    updated_pos = 0
    errors = []

    # Level 4 : info partenaire (pas d'ecriture, juste validation)
    level4 = df[df["Level"] == 4]
    if len(level4) == 0:
        raise ValidationErrorApp("Fichier STOCK : pas de ligne de niveau 4 (Partenaire).")

    # Level 5 : DSM
    level5 = df[df["Level"] == 5]
    dsm_map = {}  # matricule -> DSM object (pour mapping POS)

    for _, row in level5.iterrows():
        matricule = _clean_str(row.get("Unnamed: 2"))
        org_id = str(int(row["Organization Name"])) if not _is_blank(row.get("Organization Name")) else None
        color_code = _clean_str(row.get("Unnamed: 4"))
        sim_balance = None
        if not _is_blank(row.get("Current Balance")):
            try:
                sim_balance = float(row["Current Balance"])
            except (ValueError, TypeError):
                pass

        if not matricule:
            continue

        try:
            existing = db.query(DSM).filter(
                DSM.partner_id == partner_id, DSM.matricule == matricule
            ).first()

            if existing:
                if org_id:
                    existing.org_id = org_id
                if color_code:
                    existing.color_code = color_code
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                db.add(existing)
                dsm_map[matricule] = existing
                updated_dsm += 1
            else:
                dsm = DSM(
                    partner_id=partner_id,
                    matricule=matricule,
                    full_name=matricule,  # Nom par defaut = matricule
                    org_id=org_id,
                    color_code=color_code,
                    sim_balance=sim_balance,
                )
                db.add(dsm)
                db.flush()  # Pour recuperer l'ID
                dsm_map[matricule] = dsm
                created_dsm += 1
        except Exception as exc:
            errors.append({"entity": "DSM", "matricule": matricule, "error": str(exc)})

    db.flush()

    # Level 6 : POS
    level6 = df[df["Level"] == 6]

    for _, row in level6.iterrows():
        pos_code = _clean_str(row.get("Unnamed: 2"))
        parent_dsm = _clean_str(row.get("Unnamed: 3"))
        org_id = str(int(row["Organization Name"])) if not _is_blank(row.get("Organization Name")) else None
        color_code = _clean_str(row.get("Unnamed: 4"))
        sim_balance = None
        if not _is_blank(row.get("Current Balance")):
            try:
                sim_balance = float(row["Current Balance"])
            except (ValueError, TypeError):
                pass

        if not pos_code:
            continue

        # Trouver le DSM parent
        dsm_obj = dsm_map.get(parent_dsm)
        if not dsm_obj:
            errors.append({
                "entity": "POS",
                "code_pos": pos_code,
                "error": f"DSM parent '{parent_dsm}' introuvable.",
            })
            continue

        try:
            existing = db.query(POS).filter(
                POS.partner_id == partner_id, POS.code_pos == pos_code
            ).first()

            if existing:
                if org_id:
                    existing.org_id = org_id
                if color_code:
                    existing.color_code = color_code
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                if not existing.dsm_id:
                    existing.dsm_id = dsm_obj.id
                db.add(existing)
                updated_pos += 1
            else:
                # Les POS reels n'ont pas de dates formelles, on utilise des dates par defaut
                today = date.today()
                pos = POS(
                    partner_id=partner_id,
                    dsm_id=dsm_obj.id,
                    code_pos=pos_code,
                    name=pos_code,
                    org_id=org_id,
                    color_code=color_code,
                    sim_balance=sim_balance,
                    type_pos=TypePos.NOUVEAU,
                    status=StatutPos.ACTIF,
                    stock_initial=0,
                    stock_actuel=0,
                    date_creation=today,
                    date_expiration=today.replace(year=today.year + 1),
                )
                db.add(pos)
                created_pos += 1
        except Exception as exc:
            errors.append({"entity": "POS", "code_pos": pos_code, "error": str(exc)})

    db.commit()

    return {
        "partner_id": partner_id,
        "format": "STOCK",
        "total_dsm": len(level5),
        "created_dsm": created_dsm,
        "updated_dsm": updated_dsm,
        "total_pos": len(level6),
        "created_pos": created_pos,
        "updated_pos": updated_pos,
        "errors": errors,
    }


def import_partner_files(db: Session, *, partner_id: int, zone_bytes: bytes = None,
                         stock_bytes: bytes = None) -> dict:
    """Importe les fichiers ZONE et/ou STOCK pour un partenaire.

    Args:
        db: Session SQLAlchemy
        partner_id: ID du partenaire
        zone_bytes: Contenu brut du fichier ZONE ODI (optionnel)
        stock_bytes: Contenu brut du fichier STOCK ODI (optionnel)

    Returns:
        dict avec les resultats des imports effectues
    """
    results = {}

    if zone_bytes:
        results["zone"] = import_zone_file(db, partner_id=partner_id, file_bytes=zone_bytes)

    if stock_bytes:
        results["stock"] = import_stock_file(db, partner_id=partner_id, file_bytes=stock_bytes)

    if not results:
        raise ValidationErrorApp("Aucun fichier fourni pour l'import.")

    return results
