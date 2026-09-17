"""Tests spec §45-46 — Prime DSM refonte complète (correctif 118).

- Objectifs partenaire création 118 (59×2), revenus 29.5M (59 DSM)
- Paliers 75/85/95 → 5/6/7%
- Individuel 2 POS / 500k
- Invariants: sum creations, sum revenus, double_qualified, total_prime
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.dsm import DSM
from app.models.partner import Partner
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.dsm_objective import DSMObjective
from app.models.pos import POS, TypePos
from app.core.config import settings
from tests.conftest import _login
from app.services.dsm_prime_calculation_service import get_prime_rate_and_tier, calculate_dsm_primes_for_period, get_partner_prime_summary, get_dsm_prime_detail


def _create_partner(db: Session, code, name):
    p = Partner(code=code, name=name)
    db.add(p); db.commit(); db.refresh(p); return p
def _create_dsm(db: Session, partner_id, matricule, full_name):
    d = DSM(matricule=matricule, full_name=full_name, partner_id=partner_id)
    db.add(d); db.commit(); db.refresh(d); return d
def _create_period(db: Session, partner_id, code, start=date(2026,8,1), end=date(2026,8,31)):
    pp = PrimePeriod(partner_id=partner_id, code=code, label=code, start_date=start, end_date=end, status=StatutPeriode.OPEN)
    db.add(pp); db.commit(); db.refresh(pp); return pp
def _obj(db, partner_id, dsm_id, period_id, creation=2, revenue=Decimal("500000")):
    o = DSMObjective(partner_id=partner_id, dsm_id=dsm_id, prime_period_id=period_id, month=date(2026,8,1), creation_objective=creation, revenue_objective=revenue)
    db.add(o); db.commit(); db.refresh(o); return o
def _pos(db, partner_id, dsm_id, suffix, sim_balance=250000, d=date(2026,8,10)):
    p = POS(code_pos=f"SPEC-{suffix}", name=f"POS {suffix}", partner_id=partner_id, dsm_id=dsm_id, type_pos=TypePos.NOUVEAU, date_creation=d, date_expiration=d+timedelta(days=365), stock_initial=1, stock_actuel=1, sim_balance=sim_balance)
    db.add(p); db.commit(); db.refresh(p); return p

def _calc(client, pid, per_id):
    token = _login(client, "t_admin")
    r = client.post(f"/api/partners/{pid}/primes/calculate-dsm", params={"prime_period_id": per_id}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 201, r.text
    return r.json()
def _summary(client, pid, per_id):
    token = _login(client, "t_admin")
    r = client.get(f"/api/partners/{pid}/primes/dsm-summary", params={"prime_period_id": per_id}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()
def _detail(client, pid, per_id, dsm_id):
    token = _login(client, "t_admin")
    r = client.get(f"/api/partners/{pid}/primes/dsm/detail", params={"prime_period_id": per_id, "dsm_id": dsm_id}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    return r.json()

# --- paliers partenaire (118 POS) ---
def test_parter_creation_80_pos_72_73_pct_0(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-80", "Spec80")
    dsms = [_create_dsm(db, p.id, f"D{i}", f"DSM {i}") for i in range(59)]
    per = _create_period(db, p.id, "SPEC-80P")
    for d in dsms: _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    # 80 POS realised by spreading among DSMs (all NOUVEAU in period)
    for i in range(80):
        _pos(db, p.id, dsms[i % 59].id, f"80-{i}", sim_balance=10000, d=date(2026,8,5))
    pid, per_id = p.id, per.id
    db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    # global = 80/118=67.8% -> 0%
    assert s["global_creation_target"] == 118
    assert s["global_creation_realized"] == 80
    assert abs(s["global_creation_achievement_pct"] - 67.8) < 0.2
    assert s["global_creation_rate_pct"] == 0
    # revenue target = 59*500k
    assert s["global_revenue_target"] == pytest.approx(29500000.0)
    # revenue realised = 80*10000=800k
    assert s["global_revenue_realized"] == pytest.approx(800000.0)

def test_partner_83_pos_75_45_pct_5(client, seed):
    # seuil 75% sur 118 => 88.5 => 89 POS =75.42% ->5%
    db = SessionLocal()
    p = _create_partner(db, "SPEC-83", "Spec83")
    dsms = [_create_dsm(db, p.id, f"S83-D{i}", f"DSM83-{i}") for i in range(59)]
    per = _create_period(db, p.id, "SPEC-83P")
    for d in dsms: _obj(db, p.id, d.id, per.id)
    for i in range(89): _pos(db, p.id, dsms[i % 59].id, f"83-{i}-{p.id}", sim_balance=5000, d=date(2026,8,6))
    pid, per_id = p.id, per.id; db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    assert s["global_creation_realized"] == 89
    # 89/118=75.42% -> 5%
    assert abs(s["global_creation_achievement_pct"] - 75.4) < 0.3
    assert s["global_creation_rate_pct"] == 5

def test_partner_94_pos_85_45_pct_6(client, seed):
    # seuil 85% sur 118 => 100.3 => 101 POS =85.59% ->6%
    db = SessionLocal()
    p = _create_partner(db, "SPEC-94", "Spec94")
    dsms = [_create_dsm(db, p.id, f"S94-D{i}", f"DSM94-{i}") for i in range(59)]
    per = _create_period(db, p.id, "SPEC-94P")
    for d in dsms: _obj(db, p.id, d.id, per.id)
    for i in range(101): _pos(db, p.id, dsms[i % 59].id, f"94-{i}-{p.id}", sim_balance=1000, d=date(2026,8,7))
    pid, per_id = p.id, per.id; db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    assert s["global_creation_realized"] == 101
    assert abs(s["global_creation_achievement_pct"] - 85.6) < 0.3
    assert s["global_creation_rate_pct"] == 6

def test_partner_105_pos_95_45_pct_7(client, seed):
    # seuil 95% sur 118 => 112.1 => 113 POS =95.76% ->7%
    db = SessionLocal()
    p = _create_partner(db, "SPEC-105", "Spec105")
    dsms = [_create_dsm(db, p.id, f"S105-D{i}", f"DSM105-{i}") for i in range(59)]
    per = _create_period(db, p.id, "SPEC-105P")
    for d in dsms: _obj(db, p.id, d.id, per.id)
    for i in range(113): _pos(db, p.id, dsms[i % 59].id, f"105-{i}-{p.id}", sim_balance=1000, d=date(2026,8,8))
    pid, per_id = p.id, per.id; db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    assert s["global_creation_realized"] == 113
    assert abs(s["global_creation_achievement_pct"] - 95.8) < 0.3
    assert s["global_creation_rate_pct"] == 7

# --- individuel ---
def test_individual_2_pos_100pct_7(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-2POS", "Spec2POS")
    d = _create_dsm(db, p.id, "DSM2", "DSM2POS")
    per = _create_period(db, p.id, "SPEC-2POSP")
    _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    _pos(db, p.id, d.id, "a", sim_balance=250000, d=date(2026,8,10))
    _pos(db, p.id, d.id, "b", sim_balance=250000, d=date(2026,8,11))
    pid, did, per_id = p.id, d.id, per.id; db.close()
    _calc(client, pid, per_id)
    det = _detail(client, pid, per_id, did)
    assert det["creation_achievement_pct"] == pytest.approx(100.0)
    assert det["creation_rate_pct"] == 7
    assert det["revenue_achievement_pct"] == pytest.approx(100.0)
    assert det["revenue_rate_pct"] == 7
    assert det["double_qualified"] is True
    assert det["prime_status"] == "PRIMÉ"
    # Dual prime : creation 500k*7%=35k + revenus 500k*7%=35k =70k
    assert det["creation_prime_amount"] == pytest.approx(35000.0)
    assert det["revenue_prime_amount"] == pytest.approx(35000.0)
    assert det["total_prime_amount"] == pytest.approx(70000.0)

def test_individual_revenue_brackets(client, seed):
    # Test via direct tier function for revenue pct
    assert get_prime_rate_and_tier(60)[0] == 0
    assert get_prime_rate_and_tier(80)[0] == 5
    assert get_prime_rate_and_tier(90)[0] == 6
    assert get_prime_rate_and_tier(100)[0] == 7
    assert get_prime_rate_and_tier(75)[0] == 5
    assert get_prime_rate_and_tier(85)[0] == 6
    assert get_prime_rate_and_tier(95)[0] == 7

def test_double_criteria_ok_primed(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-BOTH-OK", "BothOK")
    d = _create_dsm(db, p.id, "DBO", "BothOK")
    per = _create_period(db, p.id, "SPEC-BOTHOKP")
    _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    _pos(db, p.id, d.id, "x1", sim_balance=250000)
    _pos(db, p.id, d.id, "x2", sim_balance=250000)
    pid, did, per_id = p.id, d.id, per.id; db.close()
    _calc(client, pid, per_id)
    det = _detail(client, pid, per_id, did)
    assert det["double_qualified"] is True
    assert det["total_prime_amount"] > 0

def test_quantity_ok_revenue_nok_not_primed(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-QOKRNO", "QOKRNO")
    d = _create_dsm(db, p.id, "DQR", "QOKRNO")
    per = _create_period(db, p.id, "SPEC-QOKP")
    _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    # 2 POS but revenue only 100k (<375k) -> rev 20%
    _pos(db, p.id, d.id, "q1", sim_balance=50000)
    _pos(db, p.id, d.id, "q2", sim_balance=50000)
    pid, did, per_id = p.id, d.id, per.id; db.close()
    _calc(client, pid, per_id)
    det = _detail(client, pid, per_id, did)
    assert det["creation_qualified"] is True
    assert det["revenue_qualified"] is False
    assert det["double_qualified"] is False
    # Dual prime indépendante : création primée même si revenus non atteints
    assert det["creation_prime_amount"] == pytest.approx(7000.0)  # 100k *7%
    assert det["revenue_prime_amount"] == 0
    assert det["total_prime_amount"] == pytest.approx(7000.0)
    assert det["prime_status"] == "PRIMÉ_1_COMPOSANTE"

def test_quantity_nok_revenue_ok_not_primed(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-QNOKROK", "QNOKROK")
    d = _create_dsm(db, p.id, "DQR2", "QNOKROK")
    per = _create_period(db, p.id, "SPEC-QNOKROKP")
    _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    # 1 POS => 50% not qualified, but revenue 500k from that 1 POS with large balance
    _pos(db, p.id, d.id, "q1", sim_balance=500000)
    pid, did, per_id = p.id, d.id, per.id; db.close()
    _calc(client, pid, per_id)
    det = _detail(client, pid, per_id, did)
    assert det["creation_qualified"] is False
    assert det["revenue_qualified"] is True
    # Dual prime : revenus primés même si création non atteinte
    assert det["creation_prime_amount"] == 0
    assert det["revenue_prime_amount"] == pytest.approx(35000.0)  # 500k*7%
    assert det["total_prime_amount"] == pytest.approx(35000.0)
    assert det["prime_status"] == "PRIMÉ_1_COMPOSANTE"

def test_none_qualified_not_primed(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-NONE", "NoneQ")
    d = _create_dsm(db, p.id, "DNO", "NONE")
    per = _create_period(db, p.id, "SPEC-NONEP")
    _obj(db, p.id, d.id, per.id)
    pid, did, per_id = p.id, d.id, per.id; db.close()
    _calc(client, pid, per_id)
    det = _detail(client, pid, per_id, did)
    assert det["creation_qualified"] is False
    assert det["revenue_qualified"] is False
    assert det["total_prime_amount"] == 0
    assert det["prime_status"] in ("NON_PRIMÉ", "NON_ELIGIBLE")
    assert det["creation_prime_amount"] == 0
    assert det["revenue_prime_amount"] == 0

# --- invariants ---
def test_invariants_sums(client, seed):
    db = SessionLocal()
    p = _create_partner(db, "SPEC-INV", "Inv")
    dsms = [_create_dsm(db, p.id, f"SINV-DI{i}", f"Inv{i}") for i in range(5)]
    per = _create_period(db, p.id, "SPEC-INVP")
    for d in dsms: _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    # DSM0: 2 POS 500k -> qty 100% 7% + rev 100% 7% => 70k total (35k+35k)
    _pos(db, p.id, dsms[0].id, f"inv0a-{p.id}", sim_balance=250000)
    _pos(db, p.id, dsms[0].id, f"inv0b-{p.id}", sim_balance=250000)
    # DSM1: 2 POS 400k -> qty 100% 7% =>28k creation + rev 80% 5% =>20k =>48k total
    _pos(db, p.id, dsms[1].id, f"inv1a-{p.id}", sim_balance=200000)
    _pos(db, p.id, dsms[1].id, f"inv1b-{p.id}", sim_balance=200000)
    # DSM2: 1 POS 500k -> qty 50% 0% + rev 100% 7% =>35k total (primé 1 composante)
    _pos(db, p.id, dsms[2].id, f"inv2a-{p.id}", sim_balance=500000)
    # DSM3,4: 0 POS
    pid, per_id = p.id, per.id
    dsm_ids = [d.id for d in dsms]
    db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    # invariants §30
    total_creation = sum(x["creation_realized"] for x in s["by_dsm"])
    assert s["global_creation_realized"] == total_creation
    assert total_creation == 5  # 2+2+1
    total_revenue = sum(x["revenue_realized"] for x in s["by_dsm"])
    assert s["global_revenue_realized"] == pytest.approx(total_revenue)
    assert total_revenue == pytest.approx(500000+400000+500000)
    double_cnt = sum(1 for x in s["by_dsm"] if x["double_qualified"])
    assert s["double_qualified_dsm_count"] == double_cnt
    assert double_cnt == 2  # DSM0, DSM1 (both qty+rev >=75)
    # Invariants dual primes §30
    total_prime = sum(x["total_prime_amount"] for x in s["by_dsm"])
    assert s["total_prime"] == pytest.approx(total_prime)
    total_creation_prime = sum(x["creation_prime_amount"] for x in s["by_dsm"])
    assert s["total_creation_prime"] == pytest.approx(total_creation_prime)
    total_revenue_prime = sum(x["revenue_prime_amount"] for x in s["by_dsm"])
    assert s["total_revenue_prime"] == pytest.approx(total_revenue_prime)
    assert s["total_prime"] == pytest.approx(total_creation_prime + total_revenue_prime)
    # Expected: creation 35k+28k=63k, revenue 35k+20k+35k=90k, total 153k
    assert total_creation_prime == pytest.approx(63000.0)
    assert total_revenue_prime == pytest.approx(90000.0)
    assert total_prime == pytest.approx(153000.0)
    # Verify distribution dual
    by_id = {x["dsm_id"]: x for x in s["by_dsm"]}
    assert by_id[dsm_ids[0]]["creation_prime_amount"] == pytest.approx(35000.0)
    assert by_id[dsm_ids[0]]["revenue_prime_amount"] == pytest.approx(35000.0)
    assert by_id[dsm_ids[0]]["total_prime_amount"] == pytest.approx(70000.0)
    assert by_id[dsm_ids[1]]["creation_prime_amount"] == pytest.approx(28000.0)
    assert by_id[dsm_ids[1]]["revenue_prime_amount"] == pytest.approx(20000.0)
    assert by_id[dsm_ids[1]]["total_prime_amount"] == pytest.approx(48000.0)
    assert by_id[dsm_ids[2]]["creation_prime_amount"] == 0
    assert by_id[dsm_ids[2]]["revenue_prime_amount"] == pytest.approx(35000.0)
    assert by_id[dsm_ids[2]]["total_prime_amount"] == pytest.approx(35000.0)
    # ordering: primed first sorted by prime desc => DSM0 70k, DSM1 48k, DSM2 35k
    assert s["by_dsm"][0]["dsm_id"] == dsm_ids[0]
    assert s["by_dsm"][1]["dsm_id"] == dsm_ids[1]
    assert s["by_dsm"][2]["dsm_id"] == dsm_ids[2]

def test_global_59dsm_revenue_target(client, seed):
    # Direct service check : 59 DSM ×2 =118 POS ; 59×500k=29.5M
    db = SessionLocal()
    p = _create_partner(db, "SPEC-59REV", "59Rev")
    dsms = [_create_dsm(db, p.id, f"DR{i}", f"59Rev{i}") for i in range(59)]
    per = _create_period(db, p.id, "SPEC-59REVP")
    for d in dsms: _obj(db, p.id, d.id, per.id)
    pid, per_id = p.id, per.id; db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    assert s["dsm_count"] == 59
    assert s["global_revenue_target"] == pytest.approx(29500000.0)
    assert s["global_creation_target"] == 118
    # Vérif taux global avec 0 réalisé =0%
    assert s["global_creation_achievement_pct"] == pytest.approx(0.0)
    assert s["global_revenue_achievement_pct"] == pytest.approx(0.0)


def test_global_2_pos_118_real_1_69_pct(client, seed):
    # Spec §6 : 2 /118 ×100 ≈1.69% →1.7% affichable
    db = SessionLocal()
    p = _create_partner(db, "SPEC-2POS118", "2pos118")
    dsms = [_create_dsm(db, p.id, f"DG{i}", f"G{i}") for i in range(59)]
    per = _create_period(db, p.id, "SPEC-2POS118P")
    for d in dsms: _obj(db, p.id, d.id, per.id, creation=2, revenue=Decimal("500000"))
    # seulement 2 POS chez le 1er DSM
    _pos(db, p.id, dsms[0].id, f"118-a-{p.id}", sim_balance=250000, d=date(2026,8,10))
    _pos(db, p.id, dsms[0].id, f"118-b-{p.id}", sim_balance=250000, d=date(2026,8,10))
    pid, per_id = p.id, per.id; db.close()
    _calc(client, pid, per_id)
    s = _summary(client, pid, per_id)
    assert s["global_creation_target"] == 118
    assert s["global_creation_realized"] == 2
    assert abs(s["global_creation_achievement_pct"] - 1.69) < 0.2
    assert s["global_revenue_target"] == pytest.approx(29500000.0)
    assert s["global_revenue_realized"] == pytest.approx(500000.0)
    assert abs(s["global_revenue_achievement_pct"] - 1.69) < 0.2
    # Primes totales 70k (1 DSM primé double 35k+35k)
    assert s["total_prime"] == pytest.approx(70000.0)
    assert s["total_creation_prime"] == pytest.approx(35000.0)
    assert s["total_revenue_prime"] == pytest.approx(35000.0)
