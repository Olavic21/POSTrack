#!/usr/bin/env python3
"""
import_odi : Importe les donnees reelles du partenaire ODI depuis les
fichiers Excel STOCK et ZONE.

Usage :
    cd backend
    python scripts/import_odi.py [--dry-run]

Fichiers requis :
    database/imports/ODI/ZONE ODI.xlsx
    database/imports/ODI/STOCK ODI 27 Aug 26.xlsx
"""
import argparse
import os
import sys

# Ajouter le repertoire backend dans le path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.partner import Partner
from app.services.odi_import_service import import_zone_file, import_stock_file


ZONE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "database", "imports", "ODI", "ZONE ODI.xlsx"
)
STOCK_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "database", "imports", "ODI", "STOCK ODI 27 Aug 26.xlsx"
)


def find_odi_partner(db: Session) -> int:
    """Trouve l'ID du partenaire ODI dans la base."""
    partner = db.query(Partner).filter(Partner.code == "PART-ODI").first()
    if not partner:
        print("ERREUR : Partenaire ODI (PART-ODI) non trouve dans la base.")
        print("Poussez d'abord les migrations et le seed de base.")
        sys.exit(1)
    return partner.id


def main():
    parser = argparse.ArgumentParser(description="Import des donnees ODI")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans ecriture")
    args = parser.parse_args()

    if args.dry_run:
        print("=== MODE SIMULATION (aucune ecriture) ===\n")

    # Verifier que les fichiers existent
    for path, label in [(ZONE_FILE, "ZONE"), (STOCK_FILE, "STOCK")]:
        if not os.path.exists(path):
            print(f"ERREUR : Fichier {label} introuvable : {path}")
            sys.exit(1)
        print(f"Fichier {label} : {path} ({os.path.getsize(path)} octets)")

    db = SessionLocal()
    try:
        partner_id = find_odi_partner(db)
        partner = db.query(Partner).filter(Partner.id == partner_id).first()
        print(f"\nPartenaire ODI : {partner.code} - {partner.name} (id={partner_id})")

        # Import ZONE
        print("\n--- Import ZONE ODI ---")
        with open(ZONE_FILE, "rb") as f:
            zone_bytes = f.read()
        zone_result = import_zone_file(db, partner_id=partner_id, file_bytes=zone_bytes)
        print(f"  BTS total : {zone_result['total_bts']}")
        print(f"  Crees     : {zone_result['created']}")
        print(f"  Mis a jour: {zone_result['updated']}")
        if zone_result["errors"]:
            print(f"  Erreurs   : {len(zone_result['errors'])}")
            for err in zone_result["errors"][:5]:
                print(f"    - {err}")

        # Import STOCK
        print("\n--- Import STOCK ODI ---")
        with open(STOCK_FILE, "rb") as f:
            stock_bytes = f.read()
        stock_result = import_stock_file(db, partner_id=partner_id, file_bytes=stock_bytes)
        print(f"  DSM total : {stock_result['total_dsm']}")
        print(f"  DSM crees : {stock_result['created_dsm']}")
        print(f"  DSM mis a jour : {stock_result['updated_dsm']}")
        print(f"  POS total : {stock_result['total_pos']}")
        print(f"  POS crees : {stock_result['created_pos']}")
        print(f"  POS mis a jour : {stock_result['updated_pos']}")
        if stock_result["errors"]:
            print(f"  Erreurs   : {len(stock_result['errors'])}")
            for err in stock_result["errors"][:5]:
                print(f"    - {err}")

        if args.dry_run:
            db.rollback()
            print("\n=== SIMULATION TERMINEE (rollback) ===")
        else:
            print("\n=== IMPORT TERMINE AVEC SUCCES ===")

    except Exception as exc:
        db.rollback()
        print(f"\nERREUR : {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
