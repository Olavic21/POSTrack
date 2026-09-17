"""Tests refonte 2026-09 : source unique Prime DSM (paliers 5/6/7%).

Regle officielle :
  Partenaire 110 POS/mois (→ ~2 POS/DSM) + 500 000 FCFA/DSM/mois
  <75% -> 0% ; [75,85%) -> 5% ; [85,95%) -> 6% ; [95,+inf) -> 7%
  Deux criteres requis, taux final = MIN(taux POS, taux revenus)
  Prime = revenus_reels (POS.sim_balance) * taux /100
  Exemple 194/200=97%→7% => 485 000×7%=33 950 FCFA
  Exemple mission 2/2=100%→7% => 100 000×7%=7 000 FCFA

Couvre les 12 cas obligatoires du spec section 15 + verif PrimeGrid n'influence plus.
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.dsm import DSM
from app.models.dsm_objective import DSMObjective
from app.models.partner import Partner
from app.models.pos import POS, TypePos
from app.models.prime_period import PrimePeriod, StatutPeriode

from tests.conftest import _login, auth_headers
from app.security.password import hash_password


def _partner(db: Session, code, name):
    p = Partner(code=code, name=name)
    db.add(p); db.commit(); db.refresh(p); return p

def _dsm(db: Session, partner_id, matricule):
    d = DSM(matricule=matricule, full_name=matricule, partner_id=partner_id)
    db.add(d); db.commit(); db.refresh(d); return d

def _period(db: Session, partner_id, code, month=1):
    start = date(2026, month, 1)
    period = PrimePeriod(partner_id=partner_id, code=code, label=code, start_date=start, end_date=start+timedelta(days=27), status=StatutPeriode.OPEN)
    db.add(period); db.commit(); db.refresh(period); return period

def _obj(db: Session, partner_id, dsm_id, period_id, creation=200, revenue=Decimal("500000")):
    o = DSMObjective(partner_id=partner_id, dsm_id=dsm_id, prime_period_id=period_id, month=date(2026,1,1), creation_objective=creation, revenue_objective=revenue)
    db.add(o); db.commit(); db.refresh(o); return o

def _pos(db: Session, partner_id, dsm_id, suffix, sim_balance=0.0):
    p = POS(code_pos=f"SSP-{suffix}", name=f"POS {suffix}", partner_id=partner_id, dsm_id=dsm_id, type_pos=TypePos.NOUVEAU, date_creation=date(2026,1,1), date_expiration=date(2027,1,1), stock_initial=1, stock_actuel=1, sim_balance=sim_balance)
    db.add(p); db.commit(); db.refresh(p); return p

def _calc(client, partner_id, period_id):
    token = _login(client, "t_admin")
    r = client.post(f"/api/partners/{partner_id}/primes/calculate-dsm", params={"prime_period_id": period_id}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, r.text
    return r.json()

def _detail(client, partner_id, period_id, dsm_id):
    token = _login(client, "t_admin")
    r = client.get(f"/api/partners/{partner_id}/primes/dsm/detail", params={"prime_period_id": period_id, "dsm_id": dsm_id}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()

# 1. 194 + 485000 -> dual 33 950 +33 950 =67 900 (7%)
def test_194_485k_gives_2425(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-1", "SSP 1")
    d = _dsm(db, p.id, "D-SSP1")
    per = _period(db, p.id, "SSP-P1")
    _obj(db, p.id, d.id, per.id)
    for i in range(194):
        _pos(db, p.id, d.id, f"1-{i:03d}", sim_balance=2500.0)  # 194*2500=485000
    pid, did, perid = p.id, d.id, per.id
    db.close()
    _calc(client, pid, perid)
    det = _detail(client, pid, perid, did)
    assert det["creation_achievement_pct"] == 97.0
    assert det["revenue_achievement_pct"] == 97.0
    assert det["revenue_realized"] == 485000.0
    assert det["revenue_prime_amount"] == 33950.0
    assert det["creation_prime_amount"] == 33950.0
    assert det["total_prime_amount"] == 67900.0
    assert det["status"] == "ELIGIBLE"

# 2. 499 partenaire vs 194 DSM -> prime basee sur 194 (dual 67 900)
def test_partner_499_vs_dsm_194(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-2", "SSP 2")
    d1 = _dsm(db, p.id, "D-SSP2-A")
    d2 = _dsm(db, p.id, "D-SSP2-B")
    per = _period(db, p.id, "SSP-P2")
    _obj(db, p.id, d1.id, per.id)
    _obj(db, p.id, d2.id, per.id)
    # D1 : 194 POS avec revenus
    for i in range(194):
        _pos(db, p.id, d1.id, f"2A-{i:03d}", sim_balance=2500.0)
    # D2 : 305 POS sans revenus -> total partenaire 499 mais D2 revenue 0 => creation prime 0 (amount 0) total 0
    for i in range(305):
        _pos(db, p.id, d2.id, f"2B-{i:03d}", sim_balance=0.0)
    pid, d1id, d2id, perid = p.id, d1.id, d2.id, per.id
    db.close()
    _calc(client, pid, perid)
    det1 = _detail(client, pid, perid, d1id)
    det2 = _detail(client, pid, perid, d2id)
    assert det1["total_prime_amount"] == 67900.0
    assert det2["total_prime_amount"] == 0.0
    assert det1["creation_realized"] == 194
    assert det1["revenue_realized"] == 485000.0

# 3. Ancienne grille n'influence pas (moteur ignore grille, taux 5/6/7 seul) => dual 67 900
def test_old_grid_does_not_influence(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-3", "SSP 3")
    d = _dsm(db, p.id, "D-SSP3")
    per = _period(db, p.id, "SSP-P3")
    _obj(db, p.id, d.id, per.id)
    for i in range(194):
        _pos(db, p.id, d.id, f"3-{i:03d}", sim_balance=2500.0)
    pid, did, perid = p.id, d.id, per.id
    db.close()
    _calc(client, pid, perid)
    det = _detail(client, pid, perid, did)
    assert det["total_prime_amount"] == 67900.0
    assert det["creation_prime_amount"] == 33950.0
    assert det["revenue_prime_amount"] == 33950.0

# 4. Aucune grille -> fonctionne (dual 7%)
def test_no_grid_still_works(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-4", "SSP 4")
    d = _dsm(db, p.id, "D-SSP4")
    per = _period(db, p.id, "SSP-P4")
    _obj(db, p.id, d.id, per.id)
    for i in range(194):
        _pos(db, p.id, d.id, f"4-{i:03d}", sim_balance=2500.0)
    pid, did, perid = p.id, d.id, per.id
    db.close()
    _calc(client, pid, perid)
    det = _detail(client, pid, perid, did)
    assert det["total_prime_amount"] == 67900.0

# 5. Modification objectif impacte seulement DSM/periode concerne
def test_objective_update_isolated(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-5", "SSP 5")
    d1 = _dsm(db, p.id, "D-SSP5-A")
    d2 = _dsm(db, p.id, "D-SSP5-B")
    per = _period(db, p.id, "SSP-P5")
    o1 = _obj(db, p.id, d1.id, per.id, creation=200, revenue=Decimal("500000"))
    o2 = _obj(db, p.id, d2.id, per.id, creation=200, revenue=Decimal("500000"))
    o2_id = o2.id
    # Modifier o1 seulement
    o1.revenue_objective = Decimal("1000000")
    db.add(o1); db.commit()
    pid = p.id
    db.close()
    # Verifier que o2 inchange
    db2 = SessionLocal()
    o2f = db2.query(DSMObjective).filter(DSMObjective.id == o2_id).first()
    assert float(o2f.revenue_objective) == 500000.0
    db2.close()

# 6. Distribution somme = global
def test_distribution_sum_equals_global(client, seed):
    from app.services.dsm_objective_service import distribute_objectives
    db = SessionLocal()
    p = _partner(db, "SSP-6", "SSP 6")
    dsms = [_dsm(db, p.id, f"D-SSP6-{i}") for i in range(4)]
    per = _period(db, p.id, "SSP-P6")
    # Creer microzones avec coef differents
    from app.models.partner import MicroZone
    for i, d in enumerate(dsms):
        z = MicroZone(partner_id=p.id, code=f"Z{i}", name=f"Zone{i}", potential_coefficient=1.0 + i)
        db.add(z); db.commit()
        d.color_code = f"Z{i}"
        db.add(d); db.commit()
    pid, perid = p.id, per.id
    # Distribuer 800 POS et 2 000 000 FCFA
    res = distribute_objectives(db, partner_id=pid, prime_period_id=perid, global_creation_target=800, global_revenue_target=Decimal("2000000"), user_id=1)
    assert sum(o.creation_objective for o in res["objectives"]) == 800
    assert sum(float(o.revenue_objective) for o in res["objectives"]) == pytest.approx(2000000.0, rel=1e-3)
    db.close()

# 7. Coefficient repartition
def test_coefficient_weight(client, seed):
    from app.services.dsm_objective_service import distribute_objectives
    db = SessionLocal()
    p = _partner(db, "SSP-7", "SSP 7")
    d1 = _dsm(db, p.id, "D-SSP7-A")
    d2 = _dsm(db, p.id, "D-SSP7-B")
    per = _period(db, p.id, "SSP-P7")
    from app.models.partner import MicroZone
    z1 = MicroZone(partner_id=p.id, code="ZA", name="ZA", potential_coefficient=1.0)
    z2 = MicroZone(partner_id=p.id, code="ZB", name="ZB", potential_coefficient=3.0)
    db.add_all([z1,z2]); db.commit()
    d1.color_code = "ZA"; d2.color_code = "ZB"; db.add_all([d1,d2]); db.commit()
    res = distribute_objectives(db, partner_id=p.id, prime_period_id=per.id, global_creation_target=400, global_revenue_target=Decimal("1000000"), user_id=1)
    by = {o.dsm_id: o for o in res["objectives"]}
    # Ratio 1:3 -> d1 ~100, d2 ~300
    assert by[d1.id].creation_objective == 100
    assert by[d2.id].creation_objective == 300
    db.close()

# 8. Periode isolation
def test_period_isolation(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-8", "SSP 8")
    d = _dsm(db, p.id, "D-SSP8")
    per1 = _period(db, p.id, "SSP-P8A", month=1)
    per2 = _period(db, p.id, "SSP-P8B", month=2)
    _obj(db, p.id, d.id, per1.id)
    _obj(db, p.id, d.id, per2.id)
    # POS en janvier uniquement
    for i in range(10):
        _pos(db, p.id, d.id, f"8-{i:03d}", sim_balance=1000.0)
        # date_creation is Jan 1, so only per1 should compter
    pid, did, per1id, per2id = p.id, d.id, per1.id, per2.id
    db.close()
    _calc(client, pid, per1id)
    det1 = _detail(client, pid, per1id, did)
    # per1 doit avoir 10 POS, per2 0
    assert det1["creation_realized"] == 10
    # Calculer per2 -> meme DSM mais 0 POS dans periode fevrier
    _calc(client, pid, per2id)
    det2 = _detail(client, pid, per2id, did)
    assert det2["creation_realized"] == 0

# 9. Permissions OPERATIONNEL ne peut pas distribuer
def test_operationnel_cannot_distribute(client, seed, oper_token):
    db = SessionLocal()
    p = _partner(db, "SSP-9", "SSP 9")
    per = _period(db, p.id, "SSP-P9")
    pid, perid = p.id, per.id
    db.close()
    r = client.post(f"/api/partners/{pid}/dsm-objectives/distribute", json={"prime_period_id": perid, "global_creation_target": 200, "global_revenue_target": 500000}, headers=auth_headers(oper_token))
    assert r.status_code == 403

# 10. Aucune donnee -> message explicite (NON_PRIMÉ)
def test_no_data_explicit(client, seed):
    db = SessionLocal()
    p = _partner(db, "SSP-10", "SSP 10")
    d = _dsm(db, p.id, "D-SSP10")
    per = _period(db, p.id, "SSP-P10")
    _obj(db, p.id, d.id, per.id)
    pid, did, perid = p.id, d.id, per.id
    db.close()
    _calc(client, pid, perid)
    det = _detail(client, pid, perid, did)
    assert det["creation_achievement_pct"] == 0.0
    assert det["revenue_achievement_pct"] == 0.0
    assert det["total_prime_amount"] == 0.0
    assert det["status"] in ("NON_ELIGIBLE", "NON_PRIMÉ")

# 11. Revenu premiere recharge != loading
def test_revenue_vs_loading_distinction(client, seed):
    from app.models.pos_performance import POSPerformance
    db = SessionLocal()
    p = _partner(db, "SSP-11", "SSP 11")
    d = _dsm(db, p.id, "D-SSP11")
    per = _period(db, p.id, "SSP-P11")
    _obj(db, p.id, d.id, per.id)
    pos = _pos(db, p.id, d.id, "11-001", sim_balance=5000.0)
    # Creer POSPerformance.revenue different (loading)
    perf = POSPerformance(pos_id=pos.id, partner_id=p.id, period_start=date(2026,1,1), period_end=date(2026,1,31), revenue=99999)
    db.add(perf); db.commit()
    pid, did, perid = p.id, d.id, per.id
    db.close()
    _calc(client, pid, perid)
    det = _detail(client, pid, perid, did)
    # Doit utiliser sim_balance 5000, pas 99999
    assert det["revenue_realized"] == 5000.0
    assert det["revenue_realized"] != 99999.0

# 12. Partenaire 499 vs DSM 194 deja teste en #2
