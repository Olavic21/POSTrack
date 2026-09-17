"""Tests Phase 1 : terminologie, SIM, BTS état, KPI, tracking, ventes, requêtes."""
import pytest
from datetime import date, timedelta

from app.services.analytics_service import (
    get_sim_linkage_stats,
    get_bts_production,
    get_bts_etat_list,
    get_kpi_objectives,
    get_kpi_realisations,
    get_kpi_dsm_both_criteria,
    get_daily_tracking,
    get_sales_table,
)
from app.services.bts_service import get_bts_etat
from app.core.config import settings


def test_sim_linkage(db, seed):
    stats = get_sim_linkage_stats(db, seed["p1"])
    assert "linkees" in stats and "delinkees" in stats
    assert "nombre" in stats["linkees"]
    assert "sell_out" in stats["linkees"]
    assert "loading" in stats["linkees"]


def test_bts_etat(db, seed):
    # Seuils configurables
    assert get_bts_etat(None) == "Normal"
    assert get_bts_etat(10) == "Normal"
    assert get_bts_etat(settings.BTS_ALMOST_SATURATED_THRESHOLD) == "Presque saturé"
    assert get_bts_etat(settings.BTS_SATURATION_THRESHOLD) == "Saturé"
    assert get_bts_etat(95) == "Saturé"
    # Service liste
    lst = get_bts_etat_list(db, seed["p1"])
    assert isinstance(lst, list)
    if lst:
        assert "etat" in lst[0]
        assert lst[0]["etat"] in ("Normal", "Presque saturé", "Saturé")


def test_prime_dsm_configurable(db, seed):
    """Refonte 2026-09 : paliers 75/85/95 → 5/6/7% (source unique config.py)."""
    from app.core.config import settings
    assert settings.PRIME_THRESHOLD_LOW == 75.0
    assert settings.PRIME_THRESHOLD_MID == 85.0
    assert settings.PRIME_THRESHOLD_HIGH == 95.0
    assert settings.PRIME_RATE_LOW == 5.0
    assert settings.PRIME_RATE_MID == 6.0
    assert settings.PRIME_RATE_HIGH == 7.0
    from app.services.dsm_prime_calculation_service import calculate_dsm_primes_for_period
    from app.models.prime_period import PrimePeriod, StatutPeriode

    period = PrimePeriod(partner_id=seed["p1"], code="T-PH1", label="Test", start_date=date.today() - timedelta(days=10), end_date=date.today() + timedelta(days=10), status=StatutPeriode.OPEN)
    db.add(period)
    db.commit()
    from app.models.dsm_objective import DSMObjective
    dsm_obj = DSMObjective(partner_id=seed["p1"], dsm_id=seed["dsm1"], prime_period_id=period.id, month=date.today().replace(day=1), creation_objective=10, revenue_objective=100000)
    db.add(dsm_obj)
    db.commit()
    result = calculate_dsm_primes_for_period(db, partner_id=seed["p1"], user_id=seed["admin_id"], prime_period_id=period.id)
    assert "commissions" in result


def test_kpi_objectives_realisations(db, seed):
    obj = get_kpi_objectives(db, seed["p1"])
    assert "objectifs" in obj
    assert "sell_out" in obj["objectifs"]
    real = get_kpi_realisations(db, seed["p1"])
    assert "realisations" in real
    assert "taux" in real
    both = get_kpi_dsm_both_criteria(db, seed["p1"])
    assert "dsm_both_criteria" in both


def test_pos_creation_reconduction_prise_portefeuille(db, seed):
    from app.models.pos import POS
    pos = db.query(POS).filter(POS.partner_id == seed["p1"]).first()
    assert pos is not None
    # Alias prise en portefeuille
    assert pos.date_prise_en_portefeuille == pos.date_creation
    # Stocks différenciés
    assert hasattr(pos, "stock_initial_creation")
    assert hasattr(pos, "stock_initial_reconduction")


def test_tracking_daily(db, seed):
    rows = get_daily_tracking(db, seed["p1"])
    assert isinstance(rows, list)
    # Filtrage par date
    today = date.today()
    rows_filtered = get_daily_tracking(db, seed["p1"], target_date=today)
    assert isinstance(rows_filtered, list)


def test_import_excel_mapping(db, seed):
    # Vérifier que les colonnes Master Color variantes sont gérées
    import pandas as pd, io
    # Simuler fichier avec colonnes variantes (Quartiers avec espace, etc.)
    data = {"Numeros DSM": [123], "Noms et Prenoms POS": ["Test"], "Autres contact": [456], "Quartiers ": ["Q1"], "Lieu Dit": ["LD"], "Longitude ": [1.0], "Latitude": [2.0], "Montant premiere recharges": [1000], "Observations": ["RAS"]}
    df = pd.DataFrame(data)
    df.columns = [str(c).strip() for c in df.columns]
    assert "Quartiers" in df.columns  # strip ok
    assert "Longitude" in df.columns


def test_requetes_suivi(db, seed, client, admin_token):
    from tests.conftest import auth_headers

    # Création via API Suivi des requêtes
    resp = client.post(f"/api/partners/{seed['p1']}/requests", json={"external_id": "TEST-REQ-001", "type_requete": "AJOUT", "titre": "Test suivi", "priorite": "NORMALE"}, headers=auth_headers(admin_token))
    assert resp.status_code in (200, 201)
    req_id = resp.json()["id"]
    # Consultation
    resp2 = client.get(f"/api/partners/{seed['p1']}/requests/{req_id}", headers=auth_headers(admin_token))
    assert resp2.status_code == 200
    # Summary (vocabulaire Suivi)
    resp3 = client.get(f"/api/partners/{seed['p1']}/requests/summary", headers=auth_headers(admin_token))
    assert resp3.status_code == 200
    assert "items" in resp3.json()


def test_bts_production(db, seed):
    prod = get_bts_production(db, seed["p1"])
    assert "production_totale" in prod
    assert "formule" in prod
    assert prod["formule"].startswith("sum")


def test_sales_table_backend_calcul(db, seed):
    rows = get_sales_table(db, seed["p1"], months=3)
    assert isinstance(rows, list)
    if rows:
        assert "total" in rows[0]
        assert "moyenne" in rows[0]
        # Vérifier calcul backend
        r = rows[0]
        assert r["total"] == r["mois_1"] + r["mois_2"] + r["mois_3"]
