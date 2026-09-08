"""Import ZONE ODI.xlsx -> BTS pour partenaire ODI (PART-ODI).

Usage (depuis backend/) :
    python scripts/import_odi_bts.py --dry-run
    python scripts/import_odi_bts.py --commit
"""
import argparse
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.bts import BTS
from app.models.partner import Partner

ROOT = Path(__file__).resolve().parent.parent
ZONE_PATH = ROOT.parent / "database" / "imports" / "ODI" / "ZONE ODI.xlsx"

def parse_gps(value):
    if pd.isna(value):
        return None, None
    s = str(value).strip()
    # support "4.026472   9.802718" ou "4.026010, 9.734670"
    parts = re.split(r"[,\s]+", s)
    parts = [p for p in parts if p]
    if len(parts) >= 2:
        try:
            return float(parts[0]), float(parts[1])
        except:
            return None, None
    return None, None

def parse_capacity(value):
    if pd.isna(value):
        return None
    s = str(value)
    m = re.search(r"(\d+)", s)
    if m:
        try:
            return float(m.group(1))
        except:
            return None
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    if not args.dry_run and not args.commit:
        print("Précisez --dry-run ou --commit")
        sys.exit(1)

    if not ZONE_PATH.exists():
        print(f"Fichier absent : {ZONE_PATH}")
        sys.exit(1)

    db = SessionLocal()
    partenaire = db.query(Partner).filter(Partner.code == "PART-ODI").first()
    if not partenaire:
        print("Partenaire PART-ODI introuvable. Lancez seed_v4 d'abord.")
        sys.exit(1)

    df = pd.read_excel(ZONE_PATH, header=0)
    # filtrer les lignes où BTS CODE NAME est renseigné et SN numérique
    bts_rows = []
    for _, row in df.iterrows():
        code = str(row["BTS CODE NAME"]).strip() if not pd.isna(row["BTS CODE NAME"]) else ""
        sn = str(row["SN"]).strip() if not pd.isna(row["SN"]) else ""
        # ignorer RECAP et totaux
        if not code or code.lower().startswith("coverage") or code == "nan":
            continue
        if sn.upper() in ("RECAP", "NO. OF BTS"):
            continue
        # code doit commencer par DLA
        if not code.startswith("DLA"):
            continue
        bts_rows.append(row)

    existing_codes = {r[0] for r in db.query(BTS.code_bts).filter(BTS.partner_id == partenaire.id).all()}
    to_create = []
    skipped = 0
    for row in bts_rows:
        code = str(row["BTS CODE NAME"]).strip()
        if code in existing_codes:
            skipped += 1
            continue
        lat, lon = parse_gps(row["GPS COORDINATES"])
        cap = parse_capacity(row["CAPACITY"])
        zone = str(row["QUARTER"]).strip() if not pd.isna(row["QUARTER"]) else None
        # DLA189 a GPS vide -> on crée quand même sans coords
        to_create.append({
            "code_bts": code,
            "latitude": lat,
            "longitude": lon,
            "capacite_max": cap,
            "zone": zone,
        })

    print(f"ZONE ODI: {len(bts_rows)} BTS détectés, {len(existing_codes)} déjà en base, {skipped} doublons ignorés, {len(to_create)} à créer")
    for b in to_create:
        print(f"  {b['code_bts']} lat={b['latitude']} lon={b['longitude']} cap={b['capacite_max']} zone={b['zone']}")

    if args.commit:
        for b in to_create:
            db.add(BTS(
                partner_id=partenaire.id,
                code_bts=b["code_bts"],
                operateur="ODI",
                technologie="4G",
                capacite_max=b["capacite_max"],
                latitude=b["latitude"],
                longitude=b["longitude"],
                zone=b["zone"],
            ))
        db.commit()
        print(f"{len(to_create)} BTS ODI importés.")
    else:
        db.rollback()
        print(f"[DRY-RUN] {len(to_create)} BTS seraient importés.")

    db.close()

if __name__ == "__main__":
    main()
