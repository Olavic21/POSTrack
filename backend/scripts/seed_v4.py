"""Seed de démonstration aligné sur les modèles SQLAlchemy v4 actuels.

Reconstruit un jeu de données minimal cohérent : comptes (username + email),
partenaires, DSM, POS, BTS, SIM, requêtes — de quoi parcourir le flux
login -> sélection du partenaire -> pages métier contre le vrai backend.

Usage (depuis backend/, après "alembic upgrade head") :
    python scripts/seed_v4.py     # vide puis réimporte
"""
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.pos import POS, TypePos, StatutPos
from app.models.bts import BTS
from app.models.sim import SIM, StatutSim
from app.models.requete import Requete, TypeRequete, PrioriteRequete
from app.security.permissions import Role
from app.security.password import hash_password

Base.metadata.create_all(bind=engine)

# (username, email, mot_de_passe, rôle, partner_id si OPERATIONNEL)
# Comptes (username, email, mot_de_passe, rôle, partner_id si OPERATIONNEL).
# Camtel Express (partner_id=1, anciennement démo) a été retiré → plus d'utilisateur `oper` dessus.
USERS = [
    ("admin", "admin@postrack.cm", "admin123", Role.ADMIN, None),
    ("manager", "manager@postrack.cm", "manager123", Role.MANAGER, None),
    ("manager.mc", "manager.mc@postrack.cm", "manager123", Role.MANAGER, None),
    ("chef", "chef@postrack.cm", "chef123", Role.CHEF_OPERATIONNEL, None),
    ("dsm.mc", "dsm.mc@postrack.cm", "dsm123", Role.CHEF_OPERATIONNEL, None),
    ("oper.mc", "oper.mc@postrack.cm", "oper123", Role.OPERATIONNEL, 2),
]

# Les 4 partenaires réels communiqués par le client.
# MasterColor7 était une faute de frappe → corrigé en Master Color (PART-MC).
# Camtel Express (id=1, PART-001, is_active=False) était un partenaire de démo → retiré.
PARTNERS = [
    {"id": 2, "code": "PART-MC", "nom": "Master Color", "ville": "Douala", "is_active": True, "contract_start_date": date(2025, 7, 1)},
    {"id": 3, "code": "PART-GL", "nom": "Glothelo", "ville": None, "is_active": True, "contract_start_date": date(2023, 10, 23)},
    {"id": 4, "code": "PART-ODI", "nom": "Odi", "ville": None, "is_active": True, "contract_start_date": date(2026, 9, 1)},
    {"id": 5, "code": "PART-SEV", "nom": "Seven", "ville": None, "is_active": True, "contract_start_date": date(2026, 9, 1)},
]

# DSM: id=1 (DSM-DLA-01, partner=1 démo) retiré. DSM id=2 (Master Color) conservé.
DSMS = [
    {"id": 2, "matricule": "DSM-TMP-MC", "full_name": "DSM à identifier (import Master Color)", "zone": "À identifier", "partner": 2},
]

# POS: id=101/102 (partner=1 démo) retirés. POS id=201 (Master Color) conservé.
POSES = [
    {"id": 201, "code": "POS-MC-000001", "nom": "ALI - NEWBELL", "adresse": "Newbell — Casino", "partner": 2, "dsm": 2, "type": TypePos.NOUVEAU, "statut": StatutPos.ACTIF, "dc": date(2026, 6, 1), "de": date(2026, 12, 31)},
]

# BTS: anciennement rattaché à Camtel Express (partner=1) → rattaché à Master Color (partner=2).
BTS_LIST = [
    {"partner": 2, "code_bts": "BTS-MC-01", "operateur": "CAMTEL", "technologie": "4G", "capacite_max": 1000.0, "latitude": 4.0511, "longitude": 9.7679, "zone": "Douala 1er"},
]

# SIMs: celles liées aux POS 101/102 (Camtel Express démo) retirées.
# Conservées celles liées au POS 201 (Master Color) :
SIMS = [
    ("89337020000000000001", StatutSim.EN_STOCK, 201),
]

# Requêtes: EXT-REQ-001/002 (partner=1 démo) retirées.
REQUETES = []
def clear_all(db):
    """Vide les tables seedées dans l'ordre des clés étrangères."""
    from sqlalchemy import text
    tables = ["requetes", "sims", "bts", "pos", "dsm", "partners", "users"]
    db.execute(text("PRAGMA foreign_keys=OFF;"))
    for table in tables:
        db.execute(text(f"DELETE FROM {table}"))
    db.execute(text("PRAGMA foreign_keys=ON;"))
    db.commit()


def seed():
    db = SessionLocal()
    try:
        clear_all(db)

        users = {}
        for username, email, pwd, role, partner_id in USERS:
            u = User(
                username=username, email=email,
                hashed_password=hash_password(pwd),
                full_name=username, role=role, is_active=True,
                partner_id=partner_id,
            )
            db.add(u)
            db.flush()
            users[username] = u

        partners = {}
        for p in PARTNERS:
            obj = Partner(
                code=p["code"], name=p["nom"], address=p["ville"],
                is_active=p.get("is_active", True),
                contract_start_date=p.get("contract_start_date"),
            )
            obj.id = p["id"]
            db.add(obj)
            db.flush()
            partners[p["id"]] = obj

        dsms = {}
        for d in DSMS:
            obj = DSM(matricule=d["matricule"], full_name=d["full_name"],
                      zone=d["zone"], partner_id=partners[d["partner"]].id)
            obj.id = d["id"]
            db.add(obj)
            db.flush()
            dsms[d["id"]] = obj

        pos_ids = {}
        for p in POSES:
            obj = POS(
                code_pos=p["code"], name=p["nom"], address=p["adresse"],
                partner_id=partners[p["partner"]].id, dsm_id=dsms[p["dsm"]].id,
                type_pos=p["type"], status=p["statut"],
                stock_initial=0, stock_actuel=0,
                date_creation=p["dc"], date_expiration=p["de"],
            )
            obj.id = p["id"]
            db.add(obj)
            db.flush()
            pos_ids[p["id"]] = obj

        bts_objs = {}
        for b in BTS_LIST:
            obj = BTS(
                partner_id=partners[b["partner"]].id,
                code_bts=b["code_bts"], operateur=b["operateur"],
                technologie=b["technologie"], capacite_max=b["capacite_max"],
                latitude=b["latitude"], longitude=b["longitude"], zone=b["zone"],
            )
            db.add(obj)
            db.flush()
            bts_objs[b["code_bts"]] = obj

        for iccid, statut, pos_id in SIMS:
            db.add(SIM(partner_id=pos_ids[pos_id].partner_id,
                       pos_id=pos_ids[pos_id].id, iccid=iccid, status=statut))

        chef = users["chef"]
        for r in REQUETES:
            db.add(Requete(
                external_id=r["ext"], partner_id=partners[r["partner"]].id,
                type_requete=r["type"], titre=r["titre"], description=r["desc"],
                priorite=r["prio"], date_creation=r["dc"],
                nombre_demande=r["nd"], nombre_effectue=r["ne"], nombre_rejete=r["nr"],
                delai=r["delai"], demandeur_id=chef.id,
            ))

        db.commit()
        print("Seed v4 terminé :")
        print(f"  - users={len(users)} partners={len(partners)} dsms={len(dsms)}")
        print(f"  - pos={len(pos_ids)} bts={len(BTS_LIST)} sims={len(SIMS)} requetes={len(REQUETES)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()