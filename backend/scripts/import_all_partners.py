#!/usr/bin/env python3
"""
import_all_partners : Importe les donnees reelles pour ODI et CESCO
depuis les fichiers Excel STOCK et ZONE.

Usage :
    cd backend
    python scripts/import_all_partners.py [--dry-run]

Fichiers requis :
    database/imports/ODI/ZONE ODI.xlsx
    database/imports/ODI/STOCK ODI 27 Aug 26.xlsx
    database/imports/CESCO/STOCK CESCO G 02 Sept. 26.xlsx
"""
import argparse
import io
import os
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.pos import POS, TypePos, StatutPos
from app.models.bts import BTS

BASE_DIR = Path(__file__).parent.parent.parent

ODI_ZONE_FILE = BASE_DIR / "database" / "imports" / "ODI" / "ZONE ODI.xlsx"
ODI_STOCK_FILE = BASE_DIR / "database" / "imports" / "ODI" / "STOCK ODI 27 Aug 26.xlsx"
CESCO_STOCK_FILE = BASE_DIR / "database" / "imports" / "CESCO" / "STOCK CESCO G 02 Sept. 26.xlsx"


def _is_blank(value):
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        pass
    return str(value).strip() == ""


def _clean_str(value, default=""):
    if value is None:
        return default
    try:
        if pd.isna(value):
            return default
    except (TypeError, ValueError):
        pass
    return str(value).strip()


def _parse_gps(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    s = str(value).strip()
    for sep in [",", " "]:
        parts = [p.strip() for p in s.split(sep) if p.strip()]
        if len(parts) == 2:
            try:
                lat = float(parts[0])
                lon = float(parts[1])
                if 0 < lat < 10 and 0 < lon < 15:
                    return (lat, lon)
            except ValueError:
                continue
    return None


def _parse_radius(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    s = str(value).strip().lower()
    m = re.search(r"([\d.]+)\s*(m|km)", s)
    if m:
        val = float(m.group(1))
        unit = m.group(2)
        if unit == "km":
            val *= 1000
        return val
    return None


def _parse_capacity(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    s = str(value).strip()
    m = re.search(r"([\d\s]+)", s.replace(" ", ""))
    if m:
        try:
            return float(m.group(1).replace(" ", ""))
        except ValueError:
            return None
    return None


def _parse_org_id(raw):
    """Extract org_id from Organization Name field.
    Formats: '620481299' (ODI) or '"\\t620462655 - DSM4_LT13"' (CESCO)
    """
    if raw is None:
        return None
    try:
        if pd.isna(raw):
            return None
    except (TypeError, ValueError):
        pass
    s = str(raw).strip().replace("\t", "").replace('"', "").strip()
    # CESCO format: "620462655 - DSM4_LT13" -> take first part
    if " - " in s:
        s = s.split(" - ")[0].strip()
    # Try to convert to int
    try:
        return str(int(float(s)))
    except (ValueError, TypeError):
        return s


def _parse_cesco_code(raw):
    """Extract code from CESCO Organization Name like '"\\t620462655 - DSM4_LT13"' -> 'DSM4_LT13'"""
    if raw is None:
        return None
    try:
        if pd.isna(raw):
            return None
    except (TypeError, ValueError):
        pass
    s = str(raw).strip().replace("\t", "").replace('"', "").strip()
    if " - " in s:
        return s.split(" - ", 1)[1].strip()
    return s


# ============================================================
# ODI ZONE import (using existing service logic)
# ============================================================
def import_odi_zone(db: Session, partner_id: int):
    """Import ZONE ODI file."""
    if not ODI_ZONE_FILE.exists():
        print(f"  Fichier ZONE introuvable: {ODI_ZONE_FILE}")
        return

    print(f"\n--- Import ZONE ODI ---")
    with open(ODI_ZONE_FILE, "rb") as f:
        file_bytes = f.read()

    from app.services.odi_import_service import import_zone_file
    result = import_zone_file(db, partner_id=partner_id, file_bytes=file_bytes)
    print(f"  BTS total : {result['total_bts']}")
    print(f"  Crees     : {result['created']}")
    print(f"  Mis a jour: {result['updated']}")
    if result["errors"]:
        print(f"  Erreurs   : {len(result['errors'])}")
        for err in result["errors"][:5]:
            print(f"    - {err}")


# ============================================================
# ODI STOCK import (using existing service logic)
# ============================================================
def import_odi_stock(db: Session, partner_id: int):
    """Import STOCK ODI file."""
    if not ODI_STOCK_FILE.exists():
        print(f"  Fichier STOCK introuvable: {ODI_STOCK_FILE}")
        return

    print(f"\n--- Import STOCK ODI ---")
    with open(ODI_STOCK_FILE, "rb") as f:
        file_bytes = f.read()

    from app.services.odi_import_service import import_stock_file
    result = import_stock_file(db, partner_id=partner_id, file_bytes=file_bytes)
    print(f"  DSM total : {result['total_dsm']}")
    print(f"  DSM crees : {result['created_dsm']}")
    print(f"  DSM mis a jour : {result['updated_dsm']}")
    print(f"  POS total : {result['total_pos']}")
    print(f"  POS crees : {result['created_pos']}")
    print(f"  POS mis a jour : {result['updated_pos']}")
    if result["errors"]:
        print(f"  Erreurs   : {len(result['errors'])}")
        for err in result["errors"][:5]:
            print(f"    - {err}")


# ============================================================
# CESCO STOCK import (new parser for different format)
# ============================================================
def import_cesco_stock(db: Session, partner_id: int):
    """Import STOCK CESCO file (different format from ODI).

    CESCO format:
    - 4 columns: Level, Organization Name, Parent Organization Name, Current Balance
    - Organization Name: '"\\t{org_id} - {code}"'
    - Levels: 4 (master), 5 (DSM), 6 (POS), 7 (sub-POS)
    - Summary rows: 'MASTERS STOCK', 'DSM STOCK', 'POS STOCK'
    """
    if not CESCO_STOCK_FILE.exists():
        print(f"  Fichier STOCK CESCO introuvable: {CESCO_STOCK_FILE}")
        return

    print(f"\n--- Import STOCK CESCO ---")

    try:
        df = pd.read_excel(CESCO_STOCK_FILE)
        df.columns = [c.strip() for c in df.columns]
    except Exception as exc:
        print(f"  ERREUR: Fichier illisible: {exc}")
        return

    balance_col = [c for c in df.columns if "Current Balance" in c or "Balance" in c]
    balance_col = balance_col[0] if balance_col else df.columns[-1]

    # Filter out summary rows
    df = df[~df["Level"].apply(lambda x: isinstance(x, str))]

    # Level 4: master (validation only)
    level4 = df[df["Level"] == 4]
    if len(level4) == 0:
        print("  ERREUR: Pas de ligne de niveau 4 (Partenaire).")
        return

    # Level 5: DSM
    level5 = df[df["Level"] == 5]
    dsm_map = {}  # matricule -> DSM object
    created_dsm = 0
    updated_dsm = 0
    errors = []

    for _, row in level5.iterrows():
        org_id = _parse_org_id(row.get("Organization Name"))
        code = _parse_cesco_code(row.get("Organization Name"))
        matricule = code if code else f"DSM-{org_id}"

        sim_balance = None
        if not _is_blank(row.get(balance_col)):
            try:
                sim_balance = float(row[balance_col])
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
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                db.add(existing)
                dsm_map[matricule] = existing
                updated_dsm += 1
            else:
                dsm = DSM(
                    partner_id=partner_id,
                    matricule=matricule,
                    full_name=matricule,
                    org_id=org_id,
                    sim_balance=sim_balance,
                )
                db.add(dsm)
                db.flush()
                dsm_map[matricule] = dsm
                created_dsm += 1
        except Exception as exc:
            errors.append({"entity": "DSM", "matricule": matricule, "error": str(exc)})

    db.flush()

    # Build org_id -> matricule mapping for POS parent lookup
    org_to_matricule = {}
    for matricule, dsm_obj in dsm_map.items():
        if dsm_obj.org_id:
            org_to_matricule[dsm_obj.org_id] = matricule

    pos_cache = {}
    created_pos = 0
    updated_pos = 0

    # Level 6: POS
    level6 = df[df["Level"] == 6]

    for _, row in level6.iterrows():
        org_id = _parse_org_id(row.get("Organization Name"))
        pos_code_raw = _parse_cesco_code(row.get("Organization Name"))
        pos_code = pos_code_raw if pos_code_raw else f"POS-{org_id}"

        parent_org_id = _parse_org_id(row.get("Parent Organization Name"))
        parent_matricule = org_to_matricule.get(parent_org_id) if parent_org_id else None

        sim_balance = None
        if not _is_blank(row.get(balance_col)):
            try:
                sim_balance = float(row[balance_col])
            except (ValueError, TypeError):
                pass

        if not pos_code:
            continue

        # Find DSM parent
        dsm_obj = None
        if parent_matricule:
            dsm_obj = dsm_map.get(parent_matricule)
        if not dsm_obj and parent_org_id:
            # Try to find DSM by org_id
            dsm_obj = db.query(DSM).filter(
                DSM.partner_id == partner_id, DSM.org_id == parent_org_id
            ).first()

        if not dsm_obj:
            # Create placeholder DSM
            placeholder_matricule = parent_matricule or f"DSM-PH-{parent_org_id or 'unknown'}"
            dsm_obj = db.query(DSM).filter(
                DSM.partner_id == partner_id, DSM.matricule == placeholder_matricule
            ).first()
            if not dsm_obj:
                dsm_obj = DSM(
                    partner_id=partner_id,
                    matricule=placeholder_matricule,
                    full_name=placeholder_matricule,
                    org_id=parent_org_id,
                )
                db.add(dsm_obj)
                db.flush()
            dsm_map[placeholder_matricule] = dsm_obj
            if parent_org_id:
                org_to_matricule[parent_org_id] = placeholder_matricule

        try:
            existing = pos_cache.get(pos_code)
            if existing is None:
                existing = db.query(POS).filter(
                    POS.partner_id == partner_id, POS.code_pos == pos_code
                ).first()

            if existing:
                pos_cache[pos_code] = existing
                if org_id:
                    existing.org_id = org_id
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                if not existing.dsm_id:
                    existing.dsm_id = dsm_obj.id
                db.add(existing)
                updated_pos += 1
            else:
                today = date.today()
                pos = POS(
                    partner_id=partner_id,
                    dsm_id=dsm_obj.id,
                    code_pos=pos_code,
                    name=pos_code,
                    org_id=org_id,
                    sim_balance=sim_balance,
                    type_pos=TypePos.NOUVEAU,
                    status=StatutPos.ACTIF,
                    stock_initial=0,
                    stock_actuel=0,
                    date_creation=today,
                    date_expiration=today.replace(year=today.year + 1),
                )
                db.add(pos)
                db.flush()
                pos_cache[pos_code] = pos
                created_pos += 1
        except Exception as exc:
            errors.append({"entity": "POS", "code_pos": pos_code, "error": str(exc)})

    # Level 7: sub-POS (POS under other POS)
    level7 = df[df["Level"] == 7]
    for _, row in level7.iterrows():
        org_id = _parse_org_id(row.get("Organization Name"))
        pos_code_raw = _parse_cesco_code(row.get("Organization Name"))
        pos_code = pos_code_raw if pos_code_raw else f"POS-{org_id}"

        parent_org_id = _parse_org_id(row.get("Parent Organization Name"))
        parent_pos_code = None
        if parent_org_id:
            # Find parent POS
            parent_pos = db.query(POS).filter(
                POS.partner_id == partner_id, POS.org_id == parent_org_id
            ).first()
            if parent_pos:
                parent_pos_code = parent_pos.code_pos

        sim_balance = None
        if not _is_blank(row.get(balance_col)):
            try:
                sim_balance = float(row[balance_col])
            except (ValueError, TypeError):
                pass

        if not pos_code:
            continue

        # For sub-POS, assign to same DSM as parent POS
        dsm_obj = None
        if parent_pos_code:
            parent_pos = pos_cache.get(parent_pos_code)
            if parent_pos and parent_pos.dsm_id:
                dsm_obj = db.query(DSM).filter(DSM.id == parent_pos.dsm_id).first()

        if not dsm_obj:
            # Fallback: use first DSM
            if dsm_map:
                dsm_obj = list(dsm_map.values())[0]

        if not dsm_obj:
            continue

        try:
            existing = pos_cache.get(pos_code)
            if existing is None:
                existing = db.query(POS).filter(
                    POS.partner_id == partner_id, POS.code_pos == pos_code
                ).first()

            if existing:
                pos_cache[pos_code] = existing
                if org_id:
                    existing.org_id = org_id
                if sim_balance is not None:
                    existing.sim_balance = sim_balance
                db.add(existing)
                updated_pos += 1
            else:
                today = date.today()
                pos = POS(
                    partner_id=partner_id,
                    dsm_id=dsm_obj.id,
                    code_pos=pos_code,
                    name=pos_code,
                    org_id=org_id,
                    sim_balance=sim_balance,
                    type_pos=TypePos.NOUVEAU,
                    status=StatutPos.ACTIF,
                    stock_initial=0,
                    stock_actuel=0,
                    date_creation=today,
                    date_expiration=today.replace(year=today.year + 1),
                    donnees_additionnelles={"sub_of": parent_pos_code} if parent_pos_code else None,
                )
                db.add(pos)
                db.flush()
                pos_cache[pos_code] = pos
                created_pos += 1
        except Exception as exc:
            errors.append({"entity": "POS", "code_pos": pos_code, "error": str(exc)})

    db.commit()

    print(f"  DSM total     : {len(level5)}")
    print(f"  DSM crees     : {created_dsm}")
    print(f"  DSM mis a jour: {updated_dsm}")
    print(f"  POS total     : {len(level6) + len(level7)} (L6={len(level6)}, L7={len(level7)})")
    print(f"  POS crees     : {created_pos}")
    print(f"  POS mis a jour: {updated_pos}")
    if errors:
        print(f"  Erreurs       : {len(errors)}")
        for err in errors[:5]:
            print(f"    - {err}")


def main():
    parser = argparse.ArgumentParser(description="Import des donnees ODI et CESCO")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans ecriture")
    args = parser.parse_args()

    if args.dry_run:
        print("=== MODE SIMULATION (aucune ecriture) ===\n")

    db = SessionLocal()
    try:
        # ========== ODI ==========
        odi_partner = db.query(Partner).filter(Partner.code == "PART-ODI").first()
        if not odi_partner:
            print("Partenaire ODI (PART-ODI) non trouve. Creation...")
            odi_partner = Partner(
                code="PART-ODI",
                name="Orange Distribution International",
                is_active=True,
            )
            db.add(odi_partner)
            db.flush()
            print(f"  ODI cree: id={odi_partner.id}")
        else:
            print(f"Partenaire ODI: {odi_partner.code} - {odi_partner.name} (id={odi_partner.id})")

        import_odi_zone(db, odi_partner.id)
        import_odi_stock(db, odi_partner.id)

        # ========== CESCO ==========
        cesco_partner = db.query(Partner).filter(Partner.code == "PART-CESCO").first()
        if not cesco_partner:
            print("\nPartenaire CESCO (PART-CESCO) non trouve. Creation...")
            cesco_partner = Partner(
                code="PART-CESCO",
                name="CESCO",
                is_active=True,
            )
            db.add(cesco_partner)
            db.flush()
            print(f"  CESCO cree: id={cesco_partner.id}")
        else:
            print(f"\nPartenaire CESCO: {cesco_partner.code} - {cesco_partner.name} (id={cesco_partner.id})")

        import_cesco_stock(db, cesco_partner.id)

        if args.dry_run:
            db.rollback()
            print("\n=== SIMULATION TERMINEE (rollback) ===")
        else:
            print("\n=== IMPORT TERMINE AVEC SUCCES ===")

    except Exception as exc:
        db.rollback()
        print(f"\nERREUR: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
