"""Seed riche ADDITIF : complète le jeu minimal de seed_v4 sans rien effacer.

Contrairement à seed_v4.py (destructif), ce script n'ajoute que des lignes
manquantes et peut être relancé sans dupliquer les données :
  - DSM supplémentaires par partenaire
  - POS répartis sur les DSM (types/statuts/dates/coordonnées variés)
  - Historique de reconductions pour les POS RECONDUIT
  - BTS multiples + 14 jours de relevés (charge/saturation/rendement)
  - Stock SIM avec mouvement de réception initial
  - Périodes de primes + primes de création + commissions DSM

Usage (depuis backend/) :
    python scripts/seed_rich_demo.py
"""
import random
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.bts import BTS
from app.models.bts_releve import BTSReleve
from app.models.dsm import DSM
from app.models.dsm_objective import DSMObjective
from app.models.dsm_commission import DSMCommission, StatutCommission
from app.models.partner import Partner, PartnerSalesTarget
from app.models.pos import POS, StatutPos, TypePos
from app.models.pos_performance import POSPerformance, SourcePerformance
from app.models.prime import Prime, StatutPrime
from app.models.prime_grid import GridType, PrimeGrid
from app.models.prime_grid_threshold import PrimeGridThreshold
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.reconduction import Reconduction
from app.models.requete import PrioriteRequete, Requete, TypeRequete
from app.models.sim import SIM, SIMMovement, StatutSim, TypeMouvementSim
from app.models.user import User

random.seed(42)  # jeu déterministe : deux exécutions produisent les mêmes montants

QUARTIERS_DLA = [
    "Akwa", "Bonanjo", "Deido", "Newbell", "Bépanda", "Bonabéri",
    "Logbaba", "Bonamoussadi", "Makepe", "Ndogbong", "Akwa Nord", "Oyom Abang",
]
QUARTIERS_YDE = [
    "Biyem-Assi", "Odza", "Mvan", "Nsam", "Emana", "Melen",
    "Cité Verte", "Etoudi", "Mokolo", "Bastos",
]
OPERATEURS = ["CAMTEL", "ORANGE", "MTN"]
TECHNOS = ["3G", "4G", "5G"]


def get_or_create_dsm(db, matricule, full_name, zone, partner_id):
    obj = db.query(DSM).filter(DSM.matricule == matricule).first()
    if obj:
        return obj, False
    obj = DSM(matricule=matricule, full_name=full_name, zone=zone, partner_id=partner_id)
    db.add(obj)
    db.flush()
    return obj, True


def get_or_create_pos(db, partner_id, code_pos, **fields):
    obj = db.query(POS).filter(POS.partner_id == partner_id, POS.code_pos == code_pos).first()
    if obj:
        return obj, False
    obj = POS(partner_id=partner_id, code_pos=code_pos, **fields)
    db.add(obj)
    db.flush()
    return obj, True


def get_or_create_bts(db, partner_id, code_bts, **fields):
    obj = db.query(BTS).filter(BTS.partner_id == partner_id, BTS.code_bts == code_bts).first()
    if obj:
        return obj, False
    obj = BTS(partner_id=partner_id, code_bts=code_bts, **fields)
    db.add(obj)
    db.flush()
    return obj, True
def main():
    db = SessionLocal()
    stats = {"dsm": 0, "pos": 0, "reconductions": 0, "bts": 0, "releves": 0,
             "sims": 0, "movements": 0, "periodes": 0, "primes": 0,
             "commissions": 0, "requetes": 0,
             "pos_repartis": 0, "objectifs": 0, "perf_pos": 0, "perf_maj": 0,
             "grilles": 0, "objectifs_dsm": 0, "objectifs_normalises": 0}
    try:
        # Migration légère (SQLite) : les colonnes montants de pos_performance
        # n'existent pas dans les bases de démonstration existantes.
        from sqlalchemy import text
        for _col in ("revenue", "stock_value"):
            try:
                db.execute(text(f"ALTER TABLE pos_performance ADD COLUMN {_col} NUMERIC(12,2)"))
                db.commit()
            except Exception:
                db.rollback()

        # Nettoyage des triggers legacy : trg_reconductions_update_pos et
        # trg_bts_releves_update_cache referencent des colonnes supprimees
        # du schema (date_reconduction / dernier_taux_saturation) et font
        # echouer tout INSERT sur reconductions / bts_releves. La logique
        # correspondante est desormais assuree par la couche service.
        try:
            trig_rows = db.execute(text(
                "SELECT name FROM sqlite_master WHERE type='trigger' "
                "AND name IN ('trg_reconductions_update_pos', 'trg_bts_releves_update_cache')"
            )).fetchall()
            for (trig_name,) in trig_rows:
                db.execute(text(f"DROP TRIGGER {trig_name}"))
                stats["triggers_supprimes"] = stats.get("triggers_supprimes", 0) + 1
            if trig_rows:
                db.commit()
        except Exception:
            db.rollback()

        partners = {p.id: p for p in db.query(Partner).all()}
        users = {u.username: u for u in db.query(User).all()}
        admin = users["admin"]
        chef = users["chef"]

        # ------------------------------------------------------------------
        # 1. DSM supplémentaires
        # ------------------------------------------------------------------
        dsms_plan = [
            ("DSM-MC-02", "Clarisse Ngo", "Douala Ndokotti", 2),
            ("DSM-MC-03", "Yannick Talla", "Bafoussam", 2),
            ("DSM-GL-01", "Serge Ebogo", "Kribi Centre", 3),
            ("DSM-GL-02", "Olivier Manga", "Kribi Plages", 3),
            ("DSM-SEV-01", "Nadège Mbarga", "Bertoua Centre", 5),
            ("DSM-SEV-02", "Alexandre Ndi", "Bertoua Est", 5),
        ]
        dsms_by_partner = {}
        for d in db.query(DSM).all():
            dsms_by_partner.setdefault(d.partner_id, []).append(d)
        for matricule, name, zone, pid in dsms_plan:
            dsm, created = get_or_create_dsm(db, matricule, name, zone, pid)
            if created:
                stats["dsm"] += 1
                dsms_by_partner.setdefault(pid, []).append(dsm)

        # ------------------------------------------------------------------
        # 2. POS répartis sur les DSM de chaque partenaire
        # ------------------------------------------------------------------
        plans = {
            2: (QUARTIERS_DLA[:8], "MC", (4.04, 4.10, 9.70, 9.79), None),
            3: ([f"Quartier {i}" for i in range(1, 13)], "GL", (2.90, 3.00, 9.30, 9.45), None),
            5: (["Nkolbikon", "Madagascar", "Dakar", "Goura", "Bitam", "Kpoumassi",
                 "Nassara", "Djalingo"], "SEV", (4.50, 4.70, 13.55, 13.80), None),
        }
        # Partenaire 4 (ODI) : perimetre importe reel — aucun POS synthetique.
        today = date.today()
        counter = 0
        for pid, (labels, prefix, dla_box, yde_box) in plans.items():
            partner_dsms = dsms_by_partner.get(pid) or []
            if not partner_dsms:
                continue
            for i, label in enumerate(labels):
                counter += 1
                code_pos = f"POS-{prefix}-{counter:04d}"
                dsm = partner_dsms[i % len(partner_dsms)]
                zone_dsm = (dsm.zone or "")
                box = yde_box if ("Yaoundé" in zone_dsm or "YDE" in zone_dsm) and yde_box else dla_box
                lat = round(random.uniform(*box[:2]), 5)
                lng = round(random.uniform(*box[2:]), 5)
                type_pos = TypePos.NOUVEAU if i % 5 < 3 else TypePos.RECONDUIT
                statut = StatutPos.ACTIF if i % 7 else (
                    StatutPos.SUSPENDU if i % 14 else StatutPos.FERME)
                dc = today - timedelta(days=random.randint(20, 420))
                de = dc + timedelta(days=365)
                pos, created = get_or_create_pos(
                    db, pid, code_pos,
                    name=f"{random.choice(['Kiosque', 'Boutique', 'Agence', 'Point', 'Espace'])} {label}",
                    address=f"{label} — rue {random.randint(1, 99)}",
                    zone=label,
                    latitude=lat, longitude=lng,
                    dsm_id=dsm.id,
                    type_pos=type_pos, status=statut,
                    stock_initial=random.randint(40, 120),
                    stock_actuel=random.randint(5, 80),
                    date_creation=dc, date_expiration=de,
                )
                if not created:
                    continue
                stats["pos"] += 1

                if type_pos == TypePos.RECONDUIT:
                    db.add(Reconduction(
                        pos_id=pos.id,
                        old_expiration=dc + timedelta(days=180),
                        new_expiration=de,
                        motif="Renouvellement contractuel annuel",
                        author_id=admin.id,
                    ))
                    pos.date_derniere_reconduction = today - timedelta(days=random.randint(1, 60))
                    stats["reconductions"] += 1

        # ------------------------------------------------------------------
        # 3. Périodes de primes puis primes + commissions DSM
        # ------------------------------------------------------------------
        periods_plan = [
            (5, "SEV-2026-03", "Mars 2026", date(2026, 3, 1), date(2026, 3, 31), StatutPeriode.CLOSED),
            (5, "SEV-2026-04", "Avril 2026", date(2026, 4, 1), date(2026, 4, 30), StatutPeriode.CLOSED),
            (5, "SEV-2026-05", "Mai 2026", date(2026, 5, 1), date(2026, 5, 31), StatutPeriode.CLOSED),
            (5, "SEV-2026-06", "Juin 2026", date(2026, 6, 1), date(2026, 6, 30), StatutPeriode.CLOSED),
            (5, "SEV-2026-07", "Juillet 2026", date(2026, 7, 1), date(2026, 7, 31), StatutPeriode.CLOSED),
            (5, "SEV-2026-08", "Août 2026", date(2026, 8, 1), date(2026, 8, 31), StatutPeriode.OPEN),
            (5, "SEV-2026-09", "Septembre 2026", date(2026, 9, 1), date(2026, 9, 30), StatutPeriode.DRAFT),
        ]
        periods = {}
        for pid, code, label, start, end, status in periods_plan:
            period = db.query(PrimePeriod).filter(
                PrimePeriod.partner_id == pid, PrimePeriod.code == code).first()
            if not period:
                period = PrimePeriod(partner_id=pid, code=code, label=label,
                                     start_date=start, end_date=end, status=status)
                db.add(period)
                db.flush()
                stats["periodes"] += 1
            periods[(pid, code)] = period

        open_periods = {}
        for pos in db.query(POS).filter(POS.type_pos == TypePos.NOUVEAU).all():
            if db.query(Prime).filter(Prime.pos_id == pos.id).first():
                continue
            # Période ouverte la plus récente du partenaire (les périodes
            # mensuelles existantes de Master Color / Glothelo incluses).
            if pos.partner_id not in open_periods:
                open_periods[pos.partner_id] = (
                    db.query(PrimePeriod)
                    .filter(PrimePeriod.partner_id == pos.partner_id,
                            PrimePeriod.status == StatutPeriode.OPEN)
                    .order_by(PrimePeriod.start_date.desc())
                    .first()
                )
            period = open_periods[pos.partner_id]
            if not period:
                continue
            montant = random.choice([15000, 25000, 35000, 45000, 60000])
            roll = random.random()
            if roll < 0.35:
                status, validated_by = StatutPrime.PAYEE, admin.id
            elif roll < 0.65:
                status, validated_by = StatutPrime.VALIDEE, admin.id
            elif roll < 0.9:
                status, validated_by = StatutPrime.EN_ATTENTE, None
            else:
                status, validated_by = StatutPrime.BROUILLON, None
            db.add(Prime(
                pos_id=pos.id, prime_period_id=period.id,
                montant=montant, status=status,
                commentaire="Prime de création POS (seed riche)",
                demandeur_id=chef.id, validated_by=validated_by,
            ))
            stats["primes"] += 1

        for (pid, code), period in periods.items():
            for dsm in dsms_by_partner.get(pid, []):
                eligible = db.query(POS).filter(
                    POS.dsm_id == dsm.id, POS.type_pos == TypePos.NOUVEAU).count()
                db.add(DSMCommission(
                    partner_id=pid, dsm_id=dsm.id, prime_period_id=period.id,
                    eligible_pos_count=eligible,
                    amount=round(eligible * 2500 * random.uniform(0.9, 1.15), 2),
                    status=StatutCommission.VALIDATED if eligible else StatutCommission.DRAFT,
                    calculated_at=datetime.now(),
                    validated_by=admin.id if eligible else None,
                ))
                stats["commissions"] += 1

        # ------------------------------------------------------------------
        # 4. BTS + relevés sur 14 jours
        # ------------------------------------------------------------------
        dla_base = [(4.055 + 0.012 * k, 9.72 + 0.017 * k) for k in range(6)]
        yde_base = [(3.85 + 0.011 * k, 11.46 + 0.013 * k) for k in range(3)]
        bts_plan = []
        # Partenaires reels uniquement : les BTS ne sont plus rattachees au
        # partenaire de demonstration supprime.
        for k, (lat, lng) in enumerate(yde_base, start=1):
            bts_plan.append((4, f"BTS-ODI-{k:02d}", 9.25 + 0.014 * k, 13.33 + 0.015 * k, f"Garoua zone {k}"))
        for k, (lat, lng) in enumerate(dla_base[:4], start=1):
            bts_plan.append((5, f"BTS-SEV-{k:02d}", 4.53 + 0.012 * k, 13.60 + 0.014 * k, f"Bertoua zone {k}"))
        for k in range(1, 4):
            bts_plan.append((2, f"BTS-MC-{k:02d}", 4.05 + 0.01 * k, 9.73 + 0.012 * k, f"Douala MC {k}"))
        for k, (lat, lng) in enumerate([(2.92, 9.32), (2.95, 9.40)], start=1):
            bts_plan.append((3, f"BTS-GL-{k:02d}", lat, lng, f"Kribi zone {k}"))

        new_bts = []
        for pid, code, lat, lng, zone in bts_plan:
            bts, created = get_or_create_bts(
                db, pid, code,
                operateur=random.choice(OPERATEURS),
                technologie=random.choice(TECHNOS),
                capacite_max=float(random.choice([500, 1000, 1500, 2000])),
                latitude=lat, longitude=lng, zone=zone,
            )
            if created:
                stats["bts"] += 1
                new_bts.append(bts)

        now = datetime.now()
        for bts in new_bts:
            base_charge = random.uniform(45, 75)
            for day in range(13, -1, -1):
                charge = min(97.0, max(25.0, base_charge + random.uniform(-12, 18)))
                saturation = min(100.0, charge + random.uniform(-5, 8))
                db.add(BTSReleve(
                    bts_id=bts.id,
                    date_releve=now - timedelta(days=day, hours=random.randint(0, 5)),
                    charge=round(charge, 1),
                    debit=round(random.uniform(20, 80), 1),
                    connexions=random.randint(50, 400),
                    latence=round(random.uniform(10, 55), 1),
                    statut="maintenance" if charge > 90 else "actif",
                    taux_saturation=round(saturation, 1),
                    rendement=round(max(40.0, 100 - saturation * 0.6), 1),
                ))
                stats["releves"] += 1

        # ------------------------------------------------------------------
        # 5. Stock SIM + mouvement de réception
        # ------------------------------------------------------------------
        active_pos = db.query(POS).filter(POS.status == StatutPos.ACTIF).all()
        iccid_seq = db.query(SIM).count() + 1
        for _ in range(40):
            if not active_pos:
                break
            pos = random.choice(active_pos)
            iccid = f"8923701000000{iccid_seq:05d}"
            iccid_seq += 1
            if db.query(SIM).filter(SIM.iccid == iccid).first():
                continue
            roll = random.random()
            status = (StatutSim.EN_STOCK if roll < 0.4
                      else StatutSim.ACTIVE if roll < 0.65
                      else StatutSim.ASSIGNEE if roll < 0.85
                      else StatutSim.RETOURNEE if roll < 0.95
                      else StatutSim.PERDUE)
            sim = SIM(partner_id=pos.partner_id, pos_id=pos.id, iccid=iccid, status=status)
            db.add(sim)
            db.flush()
            db.add(SIMMovement(
                sim_id=sim.id, partner_id=pos.partner_id,
                movement_type=TypeMouvementSim.RECEPTION,
                author_id=admin.id, comment="Réception initiale (seed riche)",
            ))
            stats["sims"] += 1
            stats["movements"] += 1

        # ------------------------------------------------------------------
        # 6. Requêtes métier variées
        # ------------------------------------------------------------------
        requetes_plan = [
            ("EXT-RICH-101", 2, TypeRequete.AJOUT, "Demande de 25 SIM Akwa Nord",
             PrioriteRequete.HAUTE, "AC Akwa"),
            ("EXT-RICH-102", 2, TypeRequete.RECONDUCTION, "Renouvellement lot Deido",
             PrioriteRequete.NORMALE, "AC Deido"),
            ("EXT-RICH-103", 2, TypeRequete.DELINKAGE, "Détachement POS résilié Bonabéri",
             PrioriteRequete.URGENTE, "AC Bonabéri"),
            ("EXT-RICH-104", 2, TypeRequete.BASCULEMENT, "Transfert POS vers DSM Ndokotti",
             PrioriteRequete.NORMALE, "AC Ndokotti"),
            ("EXT-RICH-105", 2, TypeRequete.AUTRE, "Signalement matériel défectueux Makepe",
             PrioriteRequete.BASSE, "AC Makepe"),
            ("EXT-RICH-106", 3, TypeRequete.AJOUT, "Ouverture 12 POS Kribi centre",
             PrioriteRequete.HAUTE, "AC Kribi"),
            ("EXT-RICH-107", 3, TypeRequete.RECONDUCTION, "Prolongation contrats Kribi Plages",
             PrioriteRequete.NORMALE, "AC Kribi"),
            ("EXT-RICH-108", 4, TypeRequete.AJOUT, "Extension réseau Garoua — 30 POS",
             PrioriteRequete.HAUTE, "AC Garoua"),
            ("EXT-RICH-109", 4, TypeRequete.RECONDUCTION, "Renouvellement lots Rumde Adjia",
             PrioriteRequete.NORMALE, "AC Garoua"),
            ("EXT-RICH-110", 5, TypeRequete.AJOUT, "Lancement Bertoua — 12 POS",
             PrioriteRequete.NORMALE, "AC Bertoua"),
        ]
        for ext, pid, rtype, titre, prio, entite in requetes_plan:
            if db.query(Requete).filter(Requete.external_id == ext).first():
                continue
            done = random.randint(0, 18)
            demanded = done + random.randint(2, 12)
            finished = random.random() < 0.4
            db.add(Requete(
                external_id=ext, partner_id=pid,
                entite_en_charge=entite,
                type_requete=rtype, titre=titre,
                description=f"Demande générée par le seed riche ({entite}).",
                priorite=prio,
                date_creation=now - timedelta(days=random.randint(3, 45)),
                nombre_demande=demanded, nombre_effectue=done,
                nombre_rejete=random.randint(0, 2),
                delai=random.randint(5, 21),
                date_finalisation=now - timedelta(days=1) if finished else None,
                demandeur_id=chef.id,
                closed_at=now - timedelta(hours=12) if finished else None,
            ))
            stats["requetes"] += 1

        # ------------------------------------------------------------------
        # 7. Répartition stricte des POS dans leurs DSM (round-robin)
        # ------------------------------------------------------------------
        # Chaque partenaire dispose de plusieurs DSM ; les POS (y compris
        # ceux crees par seed_v4) sont reaffectes equitablement entre les
        # DSM du partenaire afin que l'analyse cartographique par DSM soit
        # lisible (chaque DSM possede ses propres POS).
        for pid in partners:
            partner_dsms = dsms_by_partner.get(pid) or []
            if not partner_dsms:
                continue
            partner_pos = db.query(POS).filter(POS.partner_id == pid).order_by(POS.id).all()
            # Ne pas remanier les grands périmètres importés (ex. ODI) :
            # la répartition y provient des imports réels du client.
            if len(partner_pos) > 300:
                continue
            for idx, pos_row in enumerate(partner_pos):
                cible = partner_dsms[idx % len(partner_dsms)]
                if pos_row.dsm_id != cible.id:
                    pos_row.dsm_id = cible.id
                    stats["pos_repartis"] += 1
        db.flush()

        # ------------------------------------------------------------------
        # 8. Objectifs de vente mensuels pour TOUS les partenaires
        # ------------------------------------------------------------------
        # creation/redeployment sont des volumes (nb de POS) ; sell_out /
        # loading / revenue sont des montants d'argent (FCFA).
        mois_courant = today.replace(day=1)
        objectifs_mois = []
        for offset in range(-5, 2):  # 5 mois écoulés + mois courant + mois suivant
            annee = mois_courant.year + (mois_courant.month - 1 + offset) // 12
            mois = (mois_courant.month - 1 + offset) % 12 + 1
            objectifs_mois.append(date(annee, mois, 1))
        for pid in partners:
            base_creation = random.randint(8, 25)
            base_redep = random.randint(5, 18)
            for mdate in objectifs_mois:
                existe = db.query(PartnerSalesTarget).filter(
                    PartnerSalesTarget.partner_id == pid,
                    PartnerSalesTarget.month == mdate,
                ).first()
                if existe:
                    continue
                db.add(PartnerSalesTarget(
                    partner_id=pid, month=mdate,
                    creation_target=max(0, base_creation + random.randint(-2, 3)),
                    redeployment_target=max(0, base_redep + random.randint(-2, 3)),
                    sell_out_target=random.choice([12, 15, 18, 22, 25]) * 1_000_000,
                    loading_target=random.choice([9, 11, 14, 17, 20]) * 1_000_000,
                    revenue_target=random.choice([20, 25, 30, 35]) * 1_000_000,
                ))
                stats["objectifs"] += 1
        db.flush()

        # ------------------------------------------------------------------
        # 9. Performances POS en montants d'argent sur les 6 derniers mois
        # ------------------------------------------------------------------
        # revenue     = montant vendu par le POS (loading / recettes)
        # stock_value = montant que le DSM a donne au POS (sell-out)
        perf_mois = objectifs_mois[:-1]  # 5 mois écoulés + mois courant
        perf_existants = db.query(POSPerformance).filter(
            POSPerformance.partner_id.in_(list(partners)),
            POSPerformance.period_start.in_(perf_mois),
        ).all()
        perf_par_cle = {(p.pos_id, p.period_start): p for p in perf_existants}
        nouveaux_perf = []
        for pos_row in db.query(POS).filter(POS.partner_id.in_(list(partners))).all():
            for mois_perf in perf_mois:
                fin_mois = (date(
                    mois_perf.year + (1 if mois_perf.month == 12 else 0),
                    1 if mois_perf.month == 12 else mois_perf.month + 1, 1,
                ) - timedelta(days=1))
                stock_value = float(random.choice([2, 3, 4, 5]) * 250_000)
                revenue = float(int(stock_value * random.uniform(0.45, 0.95)))
                perf = perf_par_cle.get((pos_row.id, mois_perf))
                if perf:
                    perf.stock_value = stock_value
                    perf.revenue = revenue
                    perf.active_sims_count = int(revenue // 1500)
                    perf.performance_score = round(revenue / 1000, 2)
                    stats["perf_maj"] += 1
                else:
                    nouveaux_perf.append({
                        "partner_id": pos_row.partner_id, "pos_id": pos_row.id,
                        "period_start": mois_perf, "period_end": fin_mois,
                        "active_sims_count": int(revenue // 1500),
                        "performance_score": round(revenue / 1000, 2),
                        "revenue": revenue, "stock_value": stock_value,
                        "source": SourcePerformance.CALCUL,
                    })
                    stats["perf_pos"] += 1
        if nouveaux_perf:
            db.bulk_insert_mappings(POSPerformance, nouveaux_perf)
        db.flush()

        # ------------------------------------------------------------------
        # 10. Requêtes métier pour les partenaires 4 et 5 (encore vides)
        # ------------------------------------------------------------------
        requetes_extra = [
            ("EXT-RICH-111", 4, TypeRequete.AJOUT, "Ouverture 10 POS Garoua centre",
             PrioriteRequete.HAUTE, "AC Garoua"),
            ("EXT-RICH-112", 4, TypeRequete.RECONDUCTION, "Renouvellement lot Poumpoumr",
             PrioriteRequete.NORMALE, "AC Garoua"),
            ("EXT-RICH-113", 4, TypeRequete.BASCULEMENT, "Transfert POS Rumde Adjia",
             PrioriteRequete.NORMALE, "AC Garoua"),
            ("EXT-RICH-114", 5, TypeRequete.AJOUT, "Lancement Bertoua — 12 POS",
             PrioriteRequete.HAUTE, "AC Bertoua"),
            ("EXT-RICH-115", 5, TypeRequete.DELINKAGE, "Retrait POS non conforme Dakar",
             PrioriteRequete.URGENTE, "AC Bertoua"),
            ("EXT-RICH-116", 5, TypeRequete.AUTRE, "Dotation matériel Nkolbikon",
             PrioriteRequete.BASSE, "AC Bertoua"),
        ]
        for ext, pid, rtype, titre, prio, entite in requetes_extra:
            if db.query(Requete).filter(Requete.external_id == ext).first():
                continue
            done = random.randint(0, 10)
            demanded = done + random.randint(2, 8)
            finished = random.random() < 0.5
            db.add(Requete(
                external_id=ext, partner_id=pid,
                entite_en_charge=entite,
                type_requete=rtype, titre=titre,
                description=f"Demande générée par le seed riche ({entite}).",
                priorite=prio,
                date_creation=now - timedelta(days=random.randint(3, 40)),
                nombre_demande=demanded, nombre_effectue=done,
                nombre_rejete=random.randint(0, 2),
                delai=random.randint(5, 18),
                date_finalisation=now - timedelta(days=1) if finished else None,
                demandeur_id=chef.id,
                closed_at=now - timedelta(hours=12) if finished else None,
            ))
            stats["requetes"] += 1

        # ------------------------------------------------------------------
        # 11. Grilles de primes actives + objectifs DSM répartis
        # ------------------------------------------------------------------
        # Le calcul « calculate-dsm » exige pour chaque partenaire :
        #   - une grille CREATION active (et REVENUE pour la prime revenus) ;
        #   - des objectifs DSM répartis pour la période (dsm_objectives).
        grilles_plan = {
            GridType.CREATION.value: [   # montant fixe FCFA par palier
                {"min_pct": 0, "max_pct": 40, "amount": 0},
                {"min_pct": 40, "max_pct": 60, "amount": 3000},
                {"min_pct": 60, "max_pct": 80, "amount": 6000},
                {"min_pct": 80, "max_pct": 100, "amount": 10000},
                {"min_pct": 100, "max_pct": None, "amount": 15000},
            ],
            GridType.REVENUE.value: [    # % du revenu réel par palier
                {"min_pct": 0, "max_pct": 40, "amount": 1},
                {"min_pct": 40, "max_pct": 60, "amount": 2},
                {"min_pct": 60, "max_pct": 80, "amount": 3},
                {"min_pct": 80, "max_pct": 100, "amount": 4},
                {"min_pct": 100, "max_pct": None, "amount": 5},
            ],
        }
        for pid in partners:
            for gtype, paliers in grilles_plan.items():
                existante = db.query(PrimeGrid).filter(
                    PrimeGrid.partner_id == pid,
                    PrimeGrid.grid_type == GridType(gtype),
                ).first()
                if not existante:
                    grille = PrimeGrid(
                        partner_id=pid,
                        name=("Grille création POS (démo)" if gtype == GridType.CREATION.value
                              else "Grille revenus (démo)"),
                        grid_type=GridType(gtype),
                        is_active=False,
                    )
                    db.add(grille)
                    db.flush()
                    for p in paliers:
                        db.add(PrimeGridThreshold(
                            grid_id=grille.id,
                            min_pct=Decimal(str(p["min_pct"])),
                            max_pct=(Decimal(str(p["max_pct"]))
                                     if p["max_pct"] is not None else None),
                            amount=Decimal(str(p["amount"])),
                        ))
                    db.flush()
                    existante = grille
                    stats["grilles"] += 1
                active = db.query(PrimeGrid).filter(
                    PrimeGrid.partner_id == pid,
                    PrimeGrid.grid_type == GridType(gtype),
                    PrimeGrid.is_active == True,  # noqa: E712
                ).first()
                if not active:
                    existante.is_active = True
                    db.add(existante)

        # Objectifs DSM répartis sur chaque période OPEN (requis par le calcul)
        for period in db.query(PrimePeriod).filter(
            PrimePeriod.status == StatutPeriode.OPEN,
        ).all():
            if period.partner_id not in partners:
                continue
            partner_dsms = dsms_by_partner.get(period.partner_id) or []
            if not partner_dsms:
                continue
            cible = db.query(PartnerSalesTarget).filter(
                PartnerSalesTarget.partner_id == period.partner_id,
                PartnerSalesTarget.month == period.start_date.replace(day=1),
            ).first()
            global_creation = (cible.creation_target if cible and cible.creation_target
                               else max(4, len(partner_dsms)))
            global_revenue = (Decimal(str(cible.revenue_target))
                              if cible and cible.revenue_target else Decimal("2000000"))
            part_creation = max(1, global_creation // len(partner_dsms))
            part_revenue = (global_revenue / len(partner_dsms)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP)
            for idx, dsm in enumerate(partner_dsms):
                existe = db.query(DSMObjective).filter(
                    DSMObjective.dsm_id == dsm.id,
                    DSMObjective.prime_period_id == period.id,
                ).first()
                if existe:
                    continue
                dernier = idx == len(partner_dsms) - 1
                creation_obj = (global_creation - part_creation * (len(partner_dsms) - 1)
                                if dernier else part_creation)
                revenue_obj = (global_revenue - part_revenue * (len(partner_dsms) - 1)
                               if dernier else part_revenue)
                db.add(DSMObjective(
                    partner_id=period.partner_id,
                    dsm_id=dsm.id,
                    prime_period_id=period.id,
                    month=period.start_date,
                    creation_objective=max(0, int(creation_obj)),
                    revenue_objective=revenue_obj,
                ))
                stats["objectifs_dsm"] += 1

        # Normalisation des anciens objectifs (sémantique volume -> FCFA) :
        # les lignes antérieures au passage « montants d'argent » portent des
        # valeurs de type 202 (unités) ; on les aligne sur la nouvelle unité.
        for t in db.query(PartnerSalesTarget).filter(
            PartnerSalesTarget.sell_out_target < 1_000_000,
        ).all():
            t.sell_out_target = random.choice([12, 15, 18, 22, 25]) * 1_000_000
            t.loading_target = random.choice([9, 11, 14, 17, 20]) * 1_000_000
            if not t.revenue_target or t.revenue_target < 1_000_000:
                t.revenue_target = random.choice([20, 25, 30, 35]) * 1_000_000
            stats["objectifs_normalises"] += 1
        db.flush()

        db.commit()
        print("Seed riche terminé (additif, rien n'a été supprimé) :")
        for key, value in stats.items():
            print(f"  - {key}: +{value}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

