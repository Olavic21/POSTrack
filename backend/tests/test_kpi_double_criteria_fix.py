"""Tests de non-régression pour le fix double critère 75% et KPI mensuels."""
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import SessionLocal
from app.models.dsm import DSM
from app.models.partner import Partner
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.models.pos import POS, TypePos
from app.models.dsm_objective import DSMObjective

from tests.conftest import _login


def _make_partner(db, code, name):
    p = Partner(code=code, name=name)
    db.add(p); db.commit(); db.refresh(p); return p

def _make_dsm(db, partner_id, matricule):
    d = DSM(matricule=matricule, full_name=matricule, partner_id=partner_id)
    db.add(d); db.commit(); db.refresh(d); return d

def _make_period(db, partner_id, code, month=1):
    start = date(2026, month, 1)
    period = PrimePeriod(partner_id=partner_id, code=code, label=code, start_date=start, end_date=start+timedelta(days=27), status=StatutPeriode.OPEN)
    db.add(period); db.commit(); db.refresh(period); return period

def _set_obj(db, partner_id, dsm_id, period_id, creation=200, revenue=Decimal("500000"), month=date(2026,1,1)):
    o = DSMObjective(partner_id=partner_id, dsm_id=dsm_id, prime_period_id=period_id, creation_objective=creation, revenue_objective=revenue, month=month)
    db.add(o); db.commit(); db.refresh(o); return o

def _make_pos(db, partner_id, dsm_id, suffix, sim_balance, month=1):
    start = date(2026, month, 1)
    pos = POS(code_pos=f"KPI-{suffix}", name=f"POS {suffix}", partner_id=partner_id, dsm_id=dsm_id, type_pos=TypePos.NOUVEAU, date_creation=start, date_expiration=start+timedelta(days=365), stock_initial=1, stock_actuel=1, sim_balance=sim_balance)
    db.add(pos); db.commit(); db.refresh(pos); return pos


def test_both_criteria_case_A_97_97(client, seed):
    """A: 97% + 97% => both True"""
    db = SessionLocal()
    p = _make_partner(db, "T-KPI-A", "KPI A")
    d = _make_dsm(db, p.id, "DSM-A")
    per = _make_period(db, p.id, "KPI-A-PER", month=1)
    _set_obj(db, p.id, d.id, per.id, creation=200, revenue=Decimal("500000"), month=date(2026,1,1))
    for i in range(194):
        _make_pos(db, p.id, d.id, f"A-{i}", sim_balance=2500, month=1)
    pid, did, month = p.id, d.id, date(2026,1,1)
    db.close()
    from app.services.analytics_service import get_kpi_dsm_both_criteria
    from app.core.database import SessionLocal as SL
    db2 = SL()
    res = get_kpi_dsm_both_criteria(db2, pid, month)
    db2.close()
    detail = [x for x in res["details"] if x["dsm_id"]==did][0]
    assert detail["qty_ok"] is True
    assert detail["amt_ok"] is True
    assert detail["both"] is True
    assert res["threshold"] == 75.0

def test_both_criteria_case_B_80_80(client, seed):
    """B: 80% + 80% => both True"""
    db = SessionLocal()
    p = _make_partner(db, "T-KPI-B", "KPI B")
    d = _make_dsm(db, p.id, "DSM-B")
    per = _make_period(db, p.id, "KPI-B-PER", month=2)
    _set_obj(db, p.id, d.id, per.id, creation=200, revenue=Decimal("500000"), month=date(2026,2,1))
    for i in range(160):
        _make_pos(db, p.id, d.id, f"B-{i}", sim_balance=2500, month=2)
    pid, did, month = p.id, d.id, date(2026,2,1)
    db.close()
    from app.services.analytics_service import get_kpi_dsm_both_criteria
    from app.core.database import SessionLocal as SL
    db2 = SL()
    res = get_kpi_dsm_both_criteria(db2, pid, month)
    db2.close()
    detail = [x for x in res["details"] if x["dsm_id"]==did][0]
    assert detail["qty_ok"] is True
    assert detail["amt_ok"] is True
    assert detail["both"] is True

def test_both_criteria_case_C_74_100(client, seed):
    """C: 74% + 100% => both False (qty fails)"""
    db = SessionLocal()
    p = _make_partner(db, "T-KPI-C", "KPI C")
    d = _make_dsm(db, p.id, "DSM-C")
    per = _make_period(db, p.id, "KPI-C-PER", month=3)
    _set_obj(db, p.id, d.id, per.id, creation=200, revenue=Decimal("500000"), month=date(2026,3,1))
    for i in range(148):
        _make_pos(db, p.id, d.id, f"C-{i}", sim_balance=3378.38, month=3)  # 148*3378 ~500k 100%
    pid, did, month = p.id, d.id, date(2026,3,1)
    db.close()
    from app.services.analytics_service import get_kpi_dsm_both_criteria
    from app.core.database import SessionLocal as SL
    db2 = SL()
    res = get_kpi_dsm_both_criteria(db2, pid, month)
    db2.close()
    detail = [x for x in res["details"] if x["dsm_id"]==did][0]
    assert detail["qty_ok"] is False
    assert detail["both"] is False

def test_both_criteria_case_D_100_74(client, seed):
    """D: 100% + 74% => both False (amt fails)"""
    db = SessionLocal()
    p = _make_partner(db, "T-KPI-D", "KPI D")
    d = _make_dsm(db, p.id, "DSM-D")
    per = _make_period(db, p.id, "KPI-D-PER", month=4)
    _set_obj(db, p.id, d.id, per.id, creation=200, revenue=Decimal("500000"), month=date(2026,4,1))
    for i in range(200):
        _make_pos(db, p.id, d.id, f"D-{i}", sim_balance=1850, month=4)  # 200*1850=370k 74%
    pid, did, month = p.id, d.id, date(2026,4,1)
    db.close()
    from app.services.analytics_service import get_kpi_dsm_both_criteria
    from app.core.database import SessionLocal as SL
    db2 = SL()
    res = get_kpi_dsm_both_criteria(db2, pid, month)
    db2.close()
    detail = [x for x in res["details"] if x["dsm_id"]==did][0]
    assert detail["amt_ok"] is False
    assert detail["both"] is False

def test_kpi_monthly_filtering(client, seed):
    """Vérifie que janvier ne compte pas février."""
    db = SessionLocal()
    p = _make_partner(db, "T-KPI-M", "KPI M")
    d = _make_dsm(db, p.id, "DSM-M")
    # Janvier : 10 POS
    for i in range(10):
        _make_pos(db, p.id, d.id, f"M-JAN-{i}", sim_balance=1000, month=1)
    # Février : 5 POS
    for i in range(5):
        _make_pos(db, p.id, d.id, f"M-FEB-{i}", sim_balance=1000, month=2)
    pid = p.id
    db.close()
    from app.services.analytics_service import get_kpi_realisations
    from app.core.database import SessionLocal as SL
    db2 = SL()
    jan = get_kpi_realisations(db2, pid, date(2026,1,1))
    feb = get_kpi_realisations(db2, pid, date(2026,2,1))
    db2.close()
    assert jan["realisations"]["creation_pos"] == 10
    assert feb["realisations"]["creation_pos"] == 5

def test_dsm_production_financiere_period_filter(client, seed):
    """Production financière doit être séparée par période."""
    db = SessionLocal()
    p = _make_partner(db, "T-PROD-F", "Prod F")
    d = _make_dsm(db, p.id, "DSM-PROD")
    per1 = _make_period(db, p.id, "PROD-P1", month=1)
    per2 = _make_period(db, p.id, "PROD-P2", month=2)
    for i in range(3):
        _make_pos(db, p.id, d.id, f"PROD1-{i}", sim_balance=1000, month=1)
    for i in range(7):
        _make_pos(db, p.id, d.id, f"PROD2-{i}", sim_balance=1000, month=2)
    pid, did, p1id, p2id = p.id, d.id, per1.id, per2.id
    db.close()
    from app.services.analytics_service import get_dsm_production_financiere
    from app.core.database import SessionLocal as SL
    db2 = SL()
    r1 = get_dsm_production_financiere(db2, pid, did, prime_period_id=p1id)
    r2 = get_dsm_production_financiere(db2, pid, did, prime_period_id=p2id)
    rall = get_dsm_production_financiere(db2, pid, did)
    db2.close()
    assert r1["production_financiere"] == 3000
    assert r1["nombre_pos"] == 3
    assert r2["production_financiere"] == 7000
    assert r2["nombre_pos"] == 7
    assert rall["production_financiere"] == 10000
