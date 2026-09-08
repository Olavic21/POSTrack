"""Import STOCK ODI 27 Aug 26.xlsx -> DSM + POS pour partenaire ODI (PART-ODI).

Structure:
  Level 4 : MASTER SIM (ignore, juste reference)
  Level 5 : DSM (Organization Name = 620..., Unnamed:2 = DSM69, Balance)
  Level 6 : POS (Organization Name = 620..., Unnamed:2 = POS163, Unnamed:3 = DSM2, Balance = stock)

Usage :
    python scripts/import_odi_stock.py --dry-run
    python scripts/import_odi_stock.py --commit
    python scripts/import_odi_stock.py --commit --limit 100  # pour test
"""
import argparse
import sys
from pathlib import Path
from datetime import date

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.pos import POS, TypePos, StatutPos
from app.models.audit import AuditLog

ROOT = Path(__file__).resolve().parent.parent
STOCK_PATH = ROOT.parent / "database" / "imports" / "ODI" / "STOCK ODI 27 Aug 26.xlsx"

BALANCE_COL = "                                                Current Balance                                                "

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--limit", type=int, default=None, help="Limiter nombre de POS à importer (test)")
    args = parser.parse_args()
    if not args.dry_run and not args.commit:
        print("Précisez --dry-run ou --commit")
        sys.exit(1)
    if not STOCK_PATH.exists():
        print(f"Fichier absent : {STOCK_PATH}")
        sys.exit(1)

    db = SessionLocal()
    partenaire = db.query(Partner).filter(Partner.code == "PART-ODI").first()
    if not partenaire:
        print("PART-ODI introuvable")
        sys.exit(1)

    df = pd.read_excel(STOCK_PATH, header=0)
    # Nettoyage colonnes
    df.columns = [str(c).strip() if not pd.isna(c) else c for c in df.columns]
    # Renommer balance col proprement
    # trouver col qui contient Balance
    balance_col = [c for c in df.columns if "Balance" in str(c)][0]
    print(f"Balance col: '{balance_col}'")
    print(f"Total rows: {len(df)}, Level 5: {(df['Level']==5).sum()}, Level6: {(df['Level']==6).sum()}")

    # DSM Level 5
    df_dsm = df[df["Level"] == 5].copy()
    df_pos = df[df["Level"] == 6].copy()
    if args.limit:
        df_pos = df_pos.head(args.limit)
        print(f"LIMIT {args.limit} POS")

    # Existing DSMs for ODI
    existing_dsm_matricules = {r[0] for r in db.query(DSM.matricule).filter(DSM.partner_id == partenaire.id).all()}
    existing_pos_codes = {r[0] for r in db.query(POS.code_pos).filter(POS.partner_id == partenaire.id).all()}

    # DSM import
    dsm_to_create = []
    dsm_map = {}  # DSM label -> DSM obj (matricule like DSM1)
    # Preload existing DSMs map
    for d in db.query(DSM).filter(DSM.partner_id == partenaire.id).all():
        # DSM.matricule is like DSM1, DSM2 etc – map both cleaned and raw
        dsm_map[d.matricule.strip()] = d
        dsm_map[d.matricule.strip().upper()] = d

    for _, row in df_dsm.iterrows():
        matricule_raw = str(row["Unnamed: 2"]).strip() if not pd.isna(row["Unnamed: 2"]) else None
        matricule = matricule_raw.strip() if matricule_raw else None
        zone = str(row["Unnamed: 3"]).strip() if not pd.isna(row["Unnamed: 3"]) else "LT4"
        org = str(row["Organization Name"]).strip()
        balance = row[balance_col] if not pd.isna(row[balance_col]) else 0
        if not matricule:
            continue
        # matricule like DSM1, DSM69 – ensure unique, prefix ODI-
        # On garde matricule tel quel mais préfixe si besoin pour éviter collision inter-partenaires (matricule global unique? non, par partner)
        # On utilise matricule tel quel (DSM1) car partner_id isole
        if matricule in existing_dsm_matricules or matricule in dsm_map:
            # déjà existant
            continue
        dsm_to_create.append({
            "matricule": matricule,
            "full_name": f"DSM {matricule} (ODI)",
            "zone": zone,
            "org": org,
            "balance": balance,
        })

    print(f"DSM à créer: {len(dsm_to_create)} / {len(df_dsm)} (existants {len(existing_dsm_matricules)})")
    for d in dsm_to_create[:10]:
        print(f"  {d['matricule']} zone={d['zone']} org={d['org']}")

    # POS import – need DSM mapping
    # Build mapping from DSM label (DSM2 etc) to DSM object – after creation
    # For dry-run we simulate
    pos_to_create = []
    skipped_pos = 0
    for _, row in df_pos.iterrows():
        org_name = str(row["Organization Name"]).strip()  # 620...
        pos_code_raw = str(row["Unnamed: 2"]).strip() if not pd.isna(row["Unnamed: 2"]) else None
        dsm_label = str(row["Unnamed: 3"]).strip() if not pd.isna(row["Unnamed: 3"]) else None
        balance = row[balance_col] if not pd.isna(row[balance_col]) else 0
        try:
            balance = int(float(balance)) if not pd.isna(balance) else 0
        except:
            balance = 0
        # code_pos unique = ODI-{org_name} (620...) garantit unicité
        code_pos = f"ODI-{org_name}"
        if code_pos in existing_pos_codes:
            skipped_pos += 1
            continue
        # dsm_label like DSM2, DSM57 – doit exister (soit déjà en base, soit dans dsm_to_create)
        if not dsm_label:
            skipped_pos += 1
            continue
        pos_to_create.append({
            "code_pos": code_pos,
            "name": f"{pos_code_raw} - {dsm_label}" if pos_code_raw else code_pos,
            "dsm_label": dsm_label,
            "balance": balance,
            "org": org_name,
        })

    print(f"POS à créer: {len(pos_to_create)} / {len(df_pos)} (existants {len(existing_pos_codes)}, skipped {skipped_pos})")
    for p in pos_to_create[:10]:
        print(f"  {p['code_pos']} {p['name']} dsm={p['dsm_label']} balance={p['balance']}")

    if args.dry_run:
        db.rollback()
        print(f"[DRY-RUN] {len(dsm_to_create)} DSM et {len(pos_to_create)} POS seraient créés")
        db.close()
        return

    # COMMIT
    # Créer DSMs
    created_dsms = {}
    for d in dsm_to_create:
        obj = DSM(matricule=d["matricule"], full_name=d["full_name"], zone=d["zone"], partner_id=partenaire.id)
        db.add(obj)
        db.flush()
        created_dsms[d["matricule"]] = obj
        dsm_map[d["matricule"]] = obj
        existing_dsm_matricules.add(d["matricule"])

    # Pour les DSM qui existaient déjà, charger
    for d in db.query(DSM).filter(DSM.partner_id == partenaire.id).all():
        if d.matricule not in dsm_map:
            dsm_map[d.matricule] = d
        # aussi avec strip upper
        dsm_map[d.matricule.strip()] = d

    # Vérifier que tous les dsm_label des POS existent, sinon créer DSM provisoire
    missing_labels = set(p["dsm_label"] for p in pos_to_create if p["dsm_label"] not in dsm_map)
    if missing_labels:
        print(f"DSM manquants pour POS: {missing_labels} -> création provisoire")
        for label in missing_labels:
            obj = DSM(matricule=label, full_name=f"DSM {label} (import stock)", zone="LT4", partner_id=partenaire.id)
            db.add(obj)
            db.flush()
            dsm_map[label] = obj
            print(f"  créé DSM provisoire {label} id={obj.id}")

    # Créer POS
    date_creation = date(2026, 8, 27)  # date du fichier STOCK 27 Aug 26
    date_expiration = date(2026, 12, 31)
    for p in pos_to_create:
        dsm = dsm_map.get(p["dsm_label"])
        if not dsm:
            print(f"WARN: DSM {p['dsm_label']} introuvable pour {p['code_pos']}, skip")
            continue
        pos = POS(
            code_pos=p["code_pos"],
            name=p["name"],
            address=f"{p['dsm_label']} - ODI",
            zone="ODI",
            partner_id=partenaire.id,
            dsm_id=dsm.id,
            type_pos=TypePos.NOUVEAU,
            status=StatutPos.ACTIF,
            stock_initial=p["balance"],
            stock_actuel=p["balance"],
            donnees_additionnelles={"org_name": p["org"], "balance": p["balance"], "source": "STOCK ODI 27 Aug 26"},
            date_creation=date_creation,
            date_expiration=date_expiration,
        )
        db.add(pos)
        db.flush()
        db.add(AuditLog(user_id=1, partner_id=partenaire.id, action="POS_CREATE", entity_type="POS", entity_id=pos.id, details=f"Import STOCK ODI {p['code_pos']} balance {p['balance']}"))

    db.commit()
    print(f"{len(dsm_to_create)} DSM et {len(pos_to_create)} POS ODI importés.")
    db.close()

if __name__ == "__main__":
    main()
