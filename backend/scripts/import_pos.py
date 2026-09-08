"""
Import des fichiers Excel partenaires (database/imports/) dans backend/postrack.db.

Adapté au schéma SQLAlchemy v4 des modèles app.models (Partners/DSM/POS)
en remplacement du script historique à base de SQL brut (tables legacy
`partenaires` / `dsm` / `pos`).

Usage (depuis backend/) :
    python scripts/import_pos.py --dry-run
    python scripts/import_pos.py --commit
"""
import argparse
import csv
import sys
from datetime import date
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal  # noqa: E402
from app.models.audit import AuditLog  # noqa: E402
from app.models.dsm import DSM  # noqa: E402
from app.models.partner import Partner  # noqa: E402
from app.models.pos import POS, StatutPos, TypePos  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
IMPORTS_DIR = ROOT.parent / "database" / "imports"

FICHIERS = {
    "master_color_juin": {
        "chemin": IMPORTS_DIR / "MASTER_COLOR" / "MASTER_COLOR_JUIN_2026.xlsx",
        "has_numero_pos": False,
        "date_creation": "2026-06-01",
        "code_partenaire": "PART-MC",
        "prefixe_code_pos": "POS-MC-",
    },
    "master_color_juillet": {
        "chemin": IMPORTS_DIR / "MASTER_COLOR" / "MASTER_COLOR_JUILLET_2026.xlsx",
        "has_numero_pos": True,
        "date_creation": "2026-07-01",
        "code_partenaire": "PART-MC",
        "prefixe_code_pos": "POS-MC-",
    },
}


def get_partenaire(db, code_partenaire):
    partenaire = db.query(Partner).filter(Partner.code == code_partenaire).first()
    if not partenaire:
        raise ValueError(
            f"Partenaire '{code_partenaire}' introuvable. "
            "Lancez d'abord : python scripts/import_database.py"
        )
    return partenaire


def get_or_create_dsm_provisoire(db, partenaire):
    dsm = db.query(DSM).filter(DSM.matricule == "DSM-TMP-IMPORT").first()
    if dsm:
        return dsm
    dsm = DSM(
        matricule="DSM-TMP-IMPORT",
        full_name="DSM à identifier (import)",
        zone="À identifier",
        partner_id=partenaire.id,
    )
    db.add(dsm)
    db.flush()
    return dsm


def noms_existants(db, partenaire):
    rows = db.query(POS.name).filter(POS.partner_id == partenaire.id).all()
    return {r[0] for r in rows}


def prochain_code_pos(db, partenaire, prefixe):
    n = db.query(POS.code_pos).filter(
        POS.partner_id == partenaire.id,
        POS.code_pos.like(prefixe + "%"),
    ).count()
    return f"{prefixe}{n + 1:06d}"


def traiter_fichier(db, config, rapport, admin_user_id=1):
    chemin = config["chemin"]
    has_numero_pos = config["has_numero_pos"]
    date_creation = date.fromisoformat(config["date_creation"])
    partenaire = get_partenaire(db, config["code_partenaire"])
    prefixe = config["prefixe_code_pos"]

    df = pd.read_excel(chemin, header=1)
    df.columns = [str(c).strip() for c in df.columns]
    noms = noms_existants(db, partenaire)

    for i, row in df.iterrows():
        ligne = i + 3
        try:
            dsm_tel = row["Numeros DSM"]
            nom_titulaire = str(row["Noms et Prenoms POS"]).strip()
            quartier = str(row["Quartiers"]).strip()
            lieu_dit = str(row["Lieu Dit"]).strip()
            contact_secondaire = str(int(row["Autres contact"]))
            montant = float(row["Montant premiere recharges"])
            observations = str(row["Observations"]).strip()
            numero_pos = str(int(row["Numero POS"])) if has_numero_pos else None

            if pd.isna(dsm_tel) or not nom_titulaire:
                raise ValueError("Numeros DSM ou Noms et Prenoms POS manquant")

            nom = f"{nom_titulaire} - {quartier}"
            if nom in noms:
                rapport.append({
                    "fichier": str(chemin.name),
                    "ligne": ligne,
                    "statut": "IGNORE (deja importe)",
                    "nom": nom,
                })
                continue

            dsm = get_or_create_dsm_provisoire(db, partenaire)
            code_pos = prochain_code_pos(db, partenaire, prefixe)
            adresse = f"{quartier} — {lieu_dit}"
            extra = {
                "contact_secondaire": contact_secondaire,
                "montant_initial": montant,
                "observations": observations,
            }
            if numero_pos:
                extra["numero_pos"] = numero_pos

            pos = POS(
                code_pos=code_pos,
                name=nom,
                address=adresse,
                zone=quartier,
                partner_id=partenaire.id,
                dsm_id=dsm.id,
                type_pos=TypePos.NOUVEAU,
                status=StatutPos.ACTIF,
                stock_initial=0,
                stock_actuel=0,
                donnees_additionnelles=extra,
                date_creation=date_creation,
                date_expiration=date(date_creation.year, 12, 31),
            )
            db.add(pos)
            db.flush()
            db.add(AuditLog(
                user_id=admin_user_id,
                partner_id=partenaire.id,
                action="POS_CREATE",
                entity_type="POS",
                entity_id=pos.id,
                details=f"Import depuis {chemin.name}, ligne {ligne}",
            ))
            noms.add(nom)
            rapport.append({
                "fichier": str(chemin.name),
                "ligne": ligne,
                "statut": "OK",
                "code_pos": code_pos,
                "nom": nom,
            })
        except Exception as exc:
            rapport.append({
                "fichier": str(chemin.name),
                "ligne": ligne,
                "statut": f"REJETE : {exc}",
                "nom": str(row.get("Noms et Prenoms POS", "?")),
            })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    if not args.dry_run and not args.commit:
        print("Precisez --dry-run ou --commit")
        sys.exit(1)

    db = SessionLocal()
    rapport = []
    for config in FICHIERS.values():
        if not config["chemin"].exists():
            print(f"Fichier absent : {config['chemin']} — ignoré.")
            continue
        traiter_fichier(db, config, rapport)

    ok = sum(1 for r in rapport if r["statut"] == "OK")
    rejetes = sum(1 for r in rapport if r["statut"].startswith("REJETE"))

    if args.commit:
        db.commit()
        print(f"{ok} POS importés en base. {rejetes} ligne(s) rejetée(s).")
    else:
        db.rollback()
        print(f"[DRY-RUN] {ok} POS seraient importés, {rejetes} ligne(s) seraient rejetées.")

    rapport_path = ROOT / "scripts" / f"rapport_import_{date.today():%Y%m%d}.csv"
    with open(rapport_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["fichier", "ligne", "statut", "code_pos", "nom"])
        writer.writeheader()
        writer.writerows(rapport)
    print(f"Rapport : {rapport_path}")

    db.close()


if __name__ == "__main__":
    main()