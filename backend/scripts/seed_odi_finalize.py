"""Seed additif FINAL : complete le jeu demo pour le partenaire Odi (PART-ODI)
et Seven, sans rien effacer (idempotent, relancable).

Comble les trous restants apres seed_demo_complet + seed_rich_demo +
seed_complement_demo :
  1. DSM Odi (Garoua) ;
  2. POS Odi repartis sur les micro-zones (types/statuts/dates varies,
     dont 2 expirations < 30 j pour les alertes) ;
  3. Stock SIM Odi + mouvements (coherence stock_actuel == nb EN_STOCK) ;
  4. POSPerformance Odi sur 3 mois (moteur analytics) ;
  5. Reconductions pour les POS RECONDUIT ;
  6. Objectifs DSM sur les periodes OPEN (ODI-2026-08, SEV-2026-08)
     => le calcul de primes devient lancable depuis l'UI ;
  7. Historique primes / commissions sur periodes CLOSED (Odi & Seven) ;
  8. Requetes terrain Odi (multi-entites + commentaires) ;
  9. Journal d'audit (F-08) sur toutes les actions sensibles.

Usage (depuis backend/) :
    python scripts/seed_odi_finalize.py
"""
from __future__ import annotations

import json
import random
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.audit import AuditLog
from app.models.dsm import DSM
from app.models.dsm_commission import DSMCommission, StatutCommission
from app.models.dsm_objective import DSMObjective
from app.models.pos import POS, StatutPos, TypePos
from app.models.pos_performance import POSPerformance, SourcePerformance
from app.models.prime import Prime, StatutPrime
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.reconduction import Reconduction
from app.models.requete import (
    PrioriteRequete, Requete, RequeteCommentaire, RequeteEntite,
    TypeRequete,
)
from app.models.sim import SIM, SIMMovement, StatutSim, TypeMouvementSim
from app.models.user import User

rng = random.Random(42)
TODAY = date.today()

PARTNER_ODI = 4
PARTNER_SEV = 5

QUARTIERS_GAROUA = [
    ("Rumde Adjia", "Rue du Marche Rumde, face pharmacie", 9.3265, 13.3981),
    ("Garoua Centre", "Boulevard de la Paix, immeuble Sawa", 9.3011, 13.3920),
    ("Poumpoumr", "Carrefour Poumpoumr, route de Ngaoundere", 9.3410, 13.4122),
    ("Yelwa", "Quartier Yelwa, pres du marche de poisson", 9.2887, 13.3764),
]


def month_start(d=None, offset=0):
    ref = d or TODAY
    m = ref.month + offset
    y = ref.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    return date(y, m, 1)


def main():
    db = SessionLocal()
    stats = {"dsm": 0, "pos": 0, "reconductions": 0, "sims": 0, "movements": 0,
             "perf": 0, "objectifs": 0, "primes": 0, "commissions": 0,
             "requetes": 0, "audit": 0}
    try:
        users = {u.username: u for u in db.query(User).all()}
        admin = users["admin"]
        author_dsm = users.get("dsm.odi") or admin
        author_oper = users.get("oper.odi") or admin

        # ------------------------------------------------------------------
        # 1. DSM Odi (get-or-create par matricule)
        # ------------------------------------------------------------------
        dsm_defs = [
            ("DSM-ODI-01", "Moussa Ali", "Garoua Centre / Rumde Adjia"),
            ("DSM-ODI-02", "Idrissou Bello", "Poumpoumr / Yelwa"),
        ]
        dsms_odi = []
        for mat, nom, zone in dsm_defs:
            d = db.query(DSM).filter(DSM.matricule == mat).first()
            if not d:
                d = DSM(matricule=mat, full_name=nom, zone=zone,
                        partner_id=PARTNER_ODI)
                db.add(d)
                db.flush()
                stats["dsm"] += 1
            dsms_odi.append(d)

        # ------------------------------------------------------------------
        # 2. POS Odi (8) — dont 2 expirations < 30 j (alertes dashboard)
        # ------------------------------------------------------------------
        pos_odi = []
        for i in range(1, 9):
            code = f"POS-ODI-{i:06d}"
            pos = db.query(POS).filter(POS.partner_id == PARTNER_ODI,
                                       POS.code_pos == code).first()
            if not pos:
                quartier, adresse, lat, lon = QUARTIERS_GAROUA[(i - 1) % 4]
                reconduit = i in (3, 6, 8)
                jours_avant_exp = [12, 25, 45, 60, 75, 20, 90, 15][i - 1]
                date_creation = TODAY - timedelta(days=rng.randint(90, 240))
                pos = POS(
                    code_pos=code,
                    name=f"KIOSK ODI {quartier.upper()} {i:02d}",
                    address=adresse,
                    zone=quartier,
                    latitude=lat + rng.uniform(-0.004, 0.004),
                    longitude=lon + rng.uniform(-0.004, 0.004),
                    partner_id=PARTNER_ODI,
                    dsm_id=dsms_odi[(i - 1) % 2].id,
                    type_pos=TypePos.RECONDUIT if reconduit else TypePos.NOUVEAU,
                    status=StatutPos.SUSPENDU if i == 5 else StatutPos.ACTIF,
                    date_creation=date_creation,
                    date_expiration=TODAY + timedelta(days=jours_avant_exp),
                    date_derniere_reconduction=(
                        TODAY - timedelta(days=rng.randint(10, 60))
                        if reconduit else None),
                )
                db.add(pos)
                db.flush()
                stats["pos"] += 1
                db.add(AuditLog(
                    user_id=admin.id, partner_id=PARTNER_ODI,
                    action="POS_CREATE", entity_type="POS", entity_id=pos.id,
                    new_value=json.dumps({"code_pos": code, "zone": quartier}),
                    reason="Creation POS lors du deploiement Garoua (demo)",
                ))
                stats["audit"] += 1
            pos_odi.append(pos)

        # ------------------------------------------------------------------
        # 3. Reconductions pour les POS RECONDUIT
        # ------------------------------------------------------------------
        for pos in pos_odi:
            if pos.type_pos == TypePos.RECONDUIT and not db.query(
                    Reconduction).filter(Reconduction.pos_id == pos.id).first():
                old_exp = pos.date_expiration - timedelta(days=365)
                db.add(Reconduction(
                    pos_id=pos.id, old_expiration=old_exp,
                    new_expiration=pos.date_expiration,
                    motif="Reconduction annuelle validee par AC Garoua",
                    author_id=author_dsm.id,
                    created_at=datetime.combine(
                        pos.date_derniere_reconduction or TODAY,
                        datetime.min.time()),
                ))
                stats["reconductions"] += 1

        # ------------------------------------------------------------------
        # 4. Stock SIM Odi + mouvements + coherence stock_actuel
        # ------------------------------------------------------------------
        base_iccid = 70000000000  # prefixe 893370209 + 11 chiffres = unique
        compteur = db.query(SIM).filter(
            SIM.iccid.like("893370209%")).count()
        repartition = [StatutSim.EN_STOCK] * 95 + \
                      [StatutSim.ACTIVE] * 14 + [StatutSim.ASSIGNEE] * 10 + \
                      [StatutSim.RETOURNEE] * 3 + [StatutSim.PERDUE] * 1
        for idx, pos in enumerate(pos_odi):
            nb = [30, 22, 18, 15, 12, 14, 10, 6][idx]
            existantes = db.query(SIM).filter(SIM.pos_id == pos.id).count()
            for j in range(existantes, nb):
                compteur += 1
                statut = repartition[(idx * 17 + j) % len(repartition)]
                sim = SIM(
                    partner_id=PARTNER_ODI, pos_id=pos.id,
                    iccid=f"893370209{base_iccid + compteur}",
                    numero_msisdn=f"620{5000000 + compteur}",
                    status=statut,
                )
                db.add(sim)
                db.flush()
                stats["sims"] += 1
                db.add(SIMMovement(
                    sim_id=sim.id, partner_id=PARTNER_ODI,
                    movement_type=TypeMouvementSim.RECEPTION,
                    author_id=author_oper.id,
                    comment=f"Approvisionnement initial {pos.code_pos}",
                    created_at=datetime.combine(
                        pos.date_creation, datetime.min.time()),
                ))
                if statut != StatutSim.EN_STOCK:
                    db.add(SIMMovement(
                        sim_id=sim.id, partner_id=PARTNER_ODI,
                        movement_type=(TypeMouvementSim.ACTIVATION
                                       if statut == StatutSim.ACTIVE
                                       else TypeMouvementSim.VENTE),
                        author_id=author_oper.id,
                        comment="Distribution client (demo)",
                        created_at=datetime.combine(
                            pos.date_creation + timedelta(days=5),
                            datetime.min.time()),
                    ))
                stats["movements"] += 1
            # coherence : stock_actuel == nb SIM EN_STOCK
            en_stock = db.query(SIM).filter(
                SIM.pos_id == pos.id,
                SIM.status == StatutSim.EN_STOCK).count()
            pos.stock_initial = max(pos.stock_initial or 0, en_stock)
            pos.stock_actuel = en_stock
        db.commit()

        # ------------------------------------------------------------------
        # 5. POSPerformance Odi — 3 derniers mois (moteur analytics)
        # ------------------------------------------------------------------
        for pos in pos_odi:
            for off in (-2, -1, 0):
                ps = month_start(offset=off)
                pe = month_start(offset=off + 1) - timedelta(days=1)
                if not db.query(POSPerformance).filter(
                        POSPerformance.pos_id == pos.id,
                        POSPerformance.period_start == ps).first():
                    clients = rng.randint(25, 120)
                    db.add(POSPerformance(
                        partner_id=PARTNER_ODI, pos_id=pos.id,
                        period_start=ps, period_end=pe,
                        clients_count=clients,
                        active_sims_count=int(clients * 0.8),
                        performance_score=Decimal(
                            f"{rng.uniform(45, 95):.2f}"),
                        source=SourcePerformance.IMPORT,
                        revenue=Decimal(clients * 5250),
                        stock_value=Decimal(clients * 3100),
                    ))
                    stats["perf"] += 1

        # ------------------------------------------------------------------
        # 6. Objectifs DSM sur les periodes OPEN (Odi + Seven)
        # ------------------------------------------------------------------
        objectifs = [
            (PARTNER_ODI, "ODI-2026-08", [d.id for d in dsms_odi], 4, 750000),
            (PARTNER_SEV, "SEV-2026-08", [11, 12], 3, 1250000),
        ]
        for pid, code, dsm_ids, obj_cre, obj_rev in objectifs:
            per = db.query(PrimePeriod).filter(
                PrimePeriod.partner_id == pid,
                PrimePeriod.code == code).first()
            if not per or per.status != StatutPeriode.OPEN:
                continue
            part = (obj_cre + len(dsm_ids) - 1) // len(dsm_ids)
            for k, dsm_id in enumerate(dsm_ids):
                if not db.query(DSMObjective).filter(
                        DSMObjective.dsm_id == dsm_id,
                        DSMObjective.prime_period_id == per.id).first():
                    dernier = k == len(dsm_ids) - 1
                    cre = obj_cre - part * (len(dsm_ids) - 1) if dernier else part
                    db.add(DSMObjective(
                        partner_id=pid, dsm_id=dsm_id,
                        prime_period_id=per.id, month=per.start_date,
                        creation_objective=cre,
                        revenue_objective=Decimal(obj_rev),
                    ))
                    db.add(AuditLog(
                        user_id=admin.id, partner_id=pid,
                        action="OBJECTIVE_UPDATE",
                        entity_type="DSM_OBJECTIVE", entity_id=dsm_id,
                        dsm_id=dsm_id, period_id=per.id,
                        old_value="null",
                        new_value=json.dumps({"creations": cre,
                                              "revenue": obj_rev}),
                        reason="Repartition initiale des objectifs (demo)",
                    ))
                    stats["objectifs"] += 1
                    stats["audit"] += 1

        # ------------------------------------------------------------------
        # 7a. Primes de creation des POS RECONDUIT d'Odi (PAYEES)
        # ------------------------------------------------------------------
        for pos in [p for p in pos_odi if p.type_pos == TypePos.RECONDUIT]:
            if db.query(Prime).filter(Prime.pos_id == pos.id).first():
                continue
            per = db.query(PrimePeriod).filter(
                PrimePeriod.partner_id == PARTNER_ODI,
                PrimePeriod.status == StatutPeriode.CLOSED,
                PrimePeriod.start_date <= pos.date_creation,
                PrimePeriod.end_date >= pos.date_creation).first()
            per = per or db.query(PrimePeriod).filter(
                PrimePeriod.partner_id == PARTNER_ODI,
                PrimePeriod.status == StatutPeriode.CLOSED).first()
            if not per:
                continue
            db.add(Prime(
                pos_id=pos.id, prime_period_id=per.id,
                montant=Decimal(10000),
                status=StatutPrime.PAYEE,
                commentaire="Prime de creation POS (demo, payee)",
                demandeur_id=author_dsm.id, validated_by=admin.id,
                validated_at=datetime.combine(per.end_date,
                                              datetime.min.time()),
            ))
            db.add(AuditLog(
                user_id=admin.id, partner_id=PARTNER_ODI,
                action="PRIME_VALIDATE", entity_type="PRIME",
                entity_id=pos.id, period_id=per.id,
                old_value="EN_ATTENTE", new_value="PAYEE",
                reason="Validation prime de creation (demo)",
            ))
            stats["primes"] += 1
            stats["audit"] += 1

        # ------------------------------------------------------------------
        # 7b. Commissions DSM historiques (Odi + Seven, periodes CLOSED)
        # ------------------------------------------------------------------
        commissions = [
            (PARTNER_ODI, "ODI-2026-07", [d.id for d in dsms_odi], 3, 450000,
             87.50, 6),
            (PARTNER_SEV, "SEV-2026-07", [11, 12], 3, 1200000,
             95.00, 5),
        ]
        for pid, code, dsm_ids, cre_rea, rev_rea, pct, prime_u in commissions:
            per = db.query(PrimePeriod).filter(
                PrimePeriod.partner_id == pid,
                PrimePeriod.code == code).first()
            if not per:
                continue
            for dsm_id in dsm_ids:
                if db.query(DSMCommission).filter(
                        DSMCommission.dsm_id == dsm_id,
                        DSMCommission.prime_period_id == per.id).first():
                    continue
                dsm = db.query(DSM).get(dsm_id)
                cre_obj = 4
                rev_obj = 750000 if pid == PARTNER_ODI else 1250000
                mont_cre = Decimal(prime_u * 1000) * Decimal(str(pct / 100))
                mont_rev = Decimal(prime_u * 500) * Decimal(str(pct / 100))
                db.add(DSMCommission(
                    partner_id=pid, dsm_id=dsm_id,
                    prime_period_id=per.id,
                    eligible_pos_count=cre_rea, amount=mont_cre + mont_rev,
                    status=StatutCommission.VALIDATED,
                    calculated_at=datetime.combine(
                        per.end_date, datetime.min.time()),
                    validated_by=admin.id,
                    creation_objective=cre_obj, creation_realized=cre_rea,
                    creation_achievement_pct=Decimal(
                        f"{cre_rea / cre_obj * 100:.2f}"),
                    creation_prime_amount=mont_cre,
                    revenue_objective=Decimal(rev_obj),
                    revenue_realized=Decimal(rev_rea),
                    revenue_achievement_pct=Decimal(f"{pct:.2f}"),
                    revenue_prime_amount=mont_rev,
                    total_prime_amount=mont_cre + mont_rev,
                    dsm_name=dsm.full_name if dsm else None,
                ))
                stats["commissions"] += 1

        # ------------------------------------------------------------------
        # 8. Requetes terrain Odi (multi-entites + commentaires)
        # ------------------------------------------------------------------
        if not db.query(Requete).filter(
                Requete.partner_id == PARTNER_ODI).first():
            r1 = Requete(
                partner_id=PARTNER_ODI, dsm_id=dsms_odi[0].id,
                external_id="EXT-ODI-001", entite_en_charge="AC Garoua",
                type_requete=TypeRequete.RECONDUCTION,
                titre="Demande de reconduction : 3 POS Rumde Adjia",
                description=("Les 3 POS du quartier Rumde Adjia arrivent a "
                             "expiration sous 30 jours. Demande de "
                             "reconduction annuelle."),
                priorite=PrioriteRequete.HAUTE,
                date_creation=datetime.now() - timedelta(days=6),
                nombre_demande=3, nombre_effectue=0, nombre_rejete=0,
                delai=5, demandeur_id=author_oper.id,
            )
            db.add(r1)
            db.flush()
            db.add(RequeteEntite(requete_id=r1.id, entity_type="POS",
                                 entity_id=pos_odi[0].id))
            db.add(RequeteCommentaire(
                requete_id=r1.id, author_id=author_dsm.id,
                commentaire="Dossier complet transmis a l'AC Garoua.",
                created_at=datetime.now() - timedelta(days=5)))
            stats["requetes"] += 1

            r2 = Requete(
                partner_id=PARTNER_ODI, dsm_id=dsms_odi[1].id,
                external_id="EXT-ODI-002", entite_en_charge="AC Garoua",
                type_requete=TypeRequete.AJOUT,
                titre="Demande d'ajout : 5 SIM Yelwa",
                description="Approvisionnement complementaire quartier Yelwa.",
                priorite=PrioriteRequete.NORMALE,
                date_creation=datetime.now() - timedelta(days=20),
                nombre_demande=5, nombre_effectue=5, nombre_rejete=0,
                delai=7, demandeur_id=author_dsm.id,
                date_finalisation=datetime.now() - timedelta(days=14),
                closed_at=datetime.now() - timedelta(days=14),
            )
            db.add(r2)
            db.flush()
            db.add(RequeteEntite(requete_id=r2.id, entity_type="PARTNER",
                                 entity_id=PARTNER_ODI))
            db.add(RequeteCommentaire(
                requete_id=r2.id, author_id=admin.id,
                commentaire="Traitee : 5 SIM livrees au POS Yelwa 08.",
                created_at=datetime.now() - timedelta(days=14)))
            stats["requetes"] += 1

        # ------------------------------------------------------------------
        # 9. Journal d'audit : identite partenaire + regles de grille
        # ------------------------------------------------------------------
        if not db.query(AuditLog).filter(
                AuditLog.action == "PARTNER_IDENTITY_UPDATE").first():
            for pid, resp in ((PARTNER_ODI, "Serge Moukoko"),
                              (PARTNER_SEV, "Eric Kamdem")):
                db.add(AuditLog(
                    user_id=admin.id, partner_id=pid,
                    action="PARTNER_IDENTITY_UPDATE", entity_type="PARTNER",
                    entity_id=pid,
                    old_value="null",
                    new_value=json.dumps({"responsable": resp}),
                    reason="Carte d'identite partenaire completee (onboarding)",
                ))
                stats["audit"] += 1
        if not db.query(AuditLog).filter(
                AuditLog.action == "GRID_RULE_UPDATE").first():
            db.add(AuditLog(
                user_id=users["manager.mc"].id, partner_id=2,
                action="GRID_RULE_UPDATE", entity_type="PRIME_GRID",
                entity_id=1,
                old_rule=json.dumps(
                    {"palier": "60-80%", "montant": 6000}),
                new_rule=json.dumps(
                    {"palier": "60-80%", "montant": 7500}),
                reason="Revalorisation grille creation POS Master Color",
            ))
            stats["audit"] += 1

        db.commit()
        print("Seed Odi finalize (additif) :")
        for k, v in stats.items():
            print(f"  - {k}: +{v}")
        total_pos = db.query(POS).filter(
            POS.partner_id == PARTNER_ODI).count()
        total_sim = db.query(SIM).filter(
            SIM.partner_id == PARTNER_ODI).count()
        nb_dsm = db.query(DSM).filter(
            DSM.partner_id == PARTNER_ODI).count()
        print(f"  => Odi : POS={total_pos} SIM={total_sim} DSM={nb_dsm}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
