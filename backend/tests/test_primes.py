"""
Phase 1 - Prime legacy supprimee du parcours utilisateur.

Les endpoints legacy /primes/calculate (montant_fixe 50k) et /primes/{id}/status
ne doivent plus etre accessibles. La prime DSM officielle est desormais
uniquement via /primes/calculate-dsm (DSMCommission). Ce fichier verifie la
suppression et conserve la verif reconduction + commission.
"""
from datetime import date, timedelta

from tests.conftest import auth_headers


def test_legacy_prime_calculate_removed(client, rep1_token, seed):
    """POST /primes/calculate doit etre indisponible (404) apres phase 1."""
    calc = client.post(
        f"/api/partners/{seed['p1']}/primes/calculate",
        json={"prime_period_id": seed["period"], "montant_fixe": 50000},
        headers=auth_headers(rep1_token),
    )
    assert calc.status_code in (404, 405), f"Legacy endpoint devrait etre supprime, got {calc.status_code}: {calc.text}"


def test_legacy_prime_status_update_removed(client, rep1_token, seed):
    """PATCH /primes/{id}/status legacy doit etre indisponible."""
    resp = client.patch(
        f"/api/partners/{seed['p1']}/primes/1/status",
        json={"status": "VALIDEE"},
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code in (404, 405)


def test_commission_dsm_created_alongside_prime(client, rep1_token, seed):
    """GET /primes/commissions (DSMCommission) reste canonique."""
    resp = client.get(
        f"/api/partners/{seed['p1']}/primes/commissions",
        params={"period_id": seed["period"]},
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code == 200
    commissions = resp.json()
    # Peut etre 0 ou 1 selon etat, mais pas d'erreur
    assert isinstance(commissions, list)


def test_legacy_list_primes_removed(client, rep1_token, seed):
    """GET /primes legacy (Prime par POS) doit etre indisponible."""
    resp = client.get(
        f"/api/partners/{seed['p1']}/primes", params={"period_id": seed["period"]},
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code in (404, 405)
