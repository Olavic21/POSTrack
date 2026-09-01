"""Complément de seed : comble les manques bloquants pour la démo.

Ajoute (additif, idempotent) :
  1. Périodes de prime mensuelles pour le partenaire 4 (Odi).
  2. Micro-zones pour les partenaires 4 (Odi) et 5 (Seven).
  3. Carte d'identité partenaire (responsable, commercial, MasterSIM).
  4. Objectifs DSM pour le partenaire 4 (Odi) sur ses périodes OPEN.
"""
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.partner import Partner, MicroZone
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.dsm_objective import DSMObjective
from app.models.dsm import DSM
from app.models.user import User, UserPartner
from app.security.permissions import Role
from app.security.password import hash_password

EXTRA_USERS = [
    ("dsm.odi", "dsm.odi@postrack.cm", "dsm123", Role.CHEF_OPERATIONNEL, None, 4),
    ("oper.odi", "oper.odi@postrack.cm", "oper123", Role.OPERATIONNEL, 4, 4),
    ("dsm.sev", "dsm.sev@postrack.cm", "dsm123", Role.CHEF_OPERATIONNEL, None, 5),
    ("oper.sev", "oper.sev@postrack.cm", "oper123", Role.OPERATIONNEL, 5, 5),
]

MONTHS = [
    (3, "Mars 2026"), (4, "Avril 2026"), (5, "Mai 2026"), (6, "Juin 2026"),
    (7, "Juillet 2026"), (8, "Août 2026"), (9, "Septembre 2026"), (10, "Octobre 2026"),
]

ODI_ZONES = [
    ("Garoua centre", 9.45, 13.40),
    ("Rumde Adjia", 9.30, 13.38),
    ("Poumpoumr", 9.50, 13.45),
    ("Yelwa", 9.33, 13.42),
]
SEV_ZONES = [
    ("Bertoua centre", 4.58, 13.66),
    ("Madagascar", 4.54, 13.68),
    ("Nkolbikon", 4.52, 13.62),
]


def main():
    db = SessionLocal()
    stats = {"periodes_odi": 0, "micro_zones_odi": 0, "micro_zones_sev": 0,
             "objectifs_odi": 0, "identite": 0}
    try:
        partners = {p.id: p for p in db.query(Partner).all()}
        odi = partners.get(4)
        sev = partners.get(5)
# ---------- 1. Périodes de prime pour Odi (4) ----------
        if odi:
            for month_num, label in MONTHS:
                code = f"ODI-2026-{month_num:02d}"
                exists = db.query(PrimePeriod).filter(
                    PrimePeriod.partner_id == 4, PrimePeriod.code == code
                ).first()
                if exists:
                    continue
                start = date(2026, month_num, 1)
                end = date(2026, month_num + 1, 1) - timedelta(days=1) if month_num < 12 \
                    else date(2026, 12, 31)
                if month_num < 8:
                    status = StatutPeriode.CLOSED
                elif month_num == 8:
                    status = StatutPeriode.OPEN
                else:
                    status = StatutPeriode.DRAFT
                db.add(PrimePeriod(partner_id=4, code=code, label=label,
                                   start_date=start, end_date=end, status=status))
                stats["periodes_odi"] += 1
            db.flush()

            # ---------- 2. Micro-zones pour Odi (4) ----------
            for i, (name, lat, lng) in enumerate(ODI_ZONES, start=1):
                exists = db.query(MicroZone).filter(
                    MicroZone.partner_id == 4, MicroZone.name == name
                ).first()
                if exists:
                    continue
                db.add(MicroZone(partner_id=4, name=name, code=f"ODI-Z{i}",
                                 latitude=lat, longitude=lng))
                stats["micro_zones_odi"] += 1
            db.flush()

        # ---------- 2b. Micro-zones pour Seven (5) ----------
        if sev:
            for i, (name, lat, lng) in enumerate(SEV_ZONES, start=1):
                exists = db.query(MicroZone).filter(
                    MicroZone.partner_id == 5, MicroZone.name == name
                ).first()
                if exists:
                    continue
                db.add(MicroZone(partner_id=5, name=name, code=f"SEV-Z{i}",
                                 latitude=lat, longitude=lng))
                stats["micro_zones_sev"] += 1
            db.flush()

# ---------- 3. Carte d'identité partenaire ----------
        identity_plan = [
            (2, {"responsable_name": "Marc Kouam", "responsable_contact": "+237699000001",
                 "commercial_name": "Sandrine Ngo", "commercial_contact": "+237699000002",
                 "master_sim_number": "622095908"}),
            (3, {"responsable_name": "Patrick Mballa", "responsable_contact": "+237699000101",
                 "commercial_name": "Claire Abena", "commercial_contact": "+237699000102",
                 "master_sim_number": "622095909"}),
            (4, {"responsable_name": "Ibrahim Sali", "responsable_contact": "+237699000201",
                 "commercial_name": "Fatimatou Ali", "commercial_contact": "+237699000202",
                 "master_sim_number": "622095910"}),
            (5, {"responsable_name": "Nadège Mbarga", "responsable_contact": "+237699000301",
                 "commercial_name": "Guy Ondoua", "commercial_contact": "+237699000302",
                 "master_sim_number": "622095911"}),
        ]
        for pid, fields in identity_plan:
            p = partners.get(pid)
            if not p:
                continue
            changed = False
            for k, v in fields.items():
                if getattr(p, k) is None:
                    setattr(p, k, v)
                    changed = True
            if changed:
                stats["identite"] += 1
                db.add(p)

        # ---------- 4. Objectifs DSM pour Odi (4) ----------
        if odi:
            odi_open_periods = db.query(PrimePeriod).filter(
                PrimePeriod.partner_id == 4, PrimePeriod.status == StatutPeriode.OPEN
            ).all()
            odi_dsms = db.query(DSM).filter(DSM.partner_id == 4).all()
            if odi_dsms:
                for period in odi_open_periods:
                    global_creation = max(len(odi_dsms), 20)
                    global_revenue = Decimal("25000000")
                    part_creation = max(1, global_creation // len(odi_dsms))
                    part_revenue = (global_revenue / len(odi_dsms)).quantize(Decimal("0.01"))
                    for idx, dsm in enumerate(odi_dsms):
                        exists = db.query(DSMObjective).filter(
                            DSMObjective.dsm_id == dsm.id,
                            DSMObjective.prime_period_id == period.id,
                        ).first()
                        if exists:
                            continue
                        dernier = idx == len(odi_dsms) - 1
                        creation_obj = (global_creation - part_creation * (len(odi_dsms) - 1)
                                        if dernier else part_creation)
                        revenue_obj = (global_revenue - part_revenue * (len(odi_dsms) - 1)
                                       if dernier else part_revenue)
                        db.add(DSMObjective(
                            partner_id=4, dsm_id=dsm.id, prime_period_id=period.id,
                            month=period.start_date,
                            creation_objective=max(0, int(creation_obj)),
                            revenue_objective=revenue_obj,
                        ))
                        stats["objectifs_odi"] += 1

        # ---------- 5. Comptes utilisateurs par partenaire ----------
        for username, email, pwd, role, partner_id, link_partner in EXTRA_USERS:
            exists = db.query(User).filter(User.username == username).first()
            if exists:
                continue
            u = User(
                username=username, email=email,
                hashed_password=hash_password(pwd),
                full_name=username, role=role, is_active=True,
                partner_id=partner_id,
            )
            db.add(u)
            db.flush()
            # Lien user -> partenaire (UserPartner) pour le contexte
            db.add(UserPartner(user_id=u.id, partner_id=link_partner))
            stats["comptes"] = stats.get("comptes", 0) + 1

        db.commit()
        print("Complément de seed terminé (additif) :")
        for key, value in stats.items():
            print(f"  - {key}: +{value}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()