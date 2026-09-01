# -*- coding: utf-8 -*-
"""Smoke test final : verifie que toutes les fonctionnalités renvoient des données."""
import json
import urllib.request

BASE = "http://127.0.0.1:8000"


def req(method, path, token=None, payload=None):
    r = urllib.request.Request(BASE + path, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(payload).encode() if payload is not None else None
    try:
        with urllib.request.urlopen(r, data, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]


def login(u, p):
    s, b = req("POST", "/api/auth/login", payload={"username": u, "password": p})
    return b["access_token"] if s == 200 and isinstance(b, dict) else None


COMPTES = [("admin", "admin123"), ("manager.mc", "manager123"),
           ("dsm.mc", "dsm123"), ("oper.mc", "oper123"),
           ("dsm.odi", "dsm123"), ("oper.odi", "oper123"),
           ("dsm.sev", "dsm123"), ("oper.sev", "oper123"),
           ("pos.mc02", "pos2026"), ("chef", "chef123")]

tokens = {}
print("== LOGINS ==")
for u, p in COMPTES:
    t = login(u, p)
    tokens[u] = t
    print(f"  {'OK ' if t else 'ERR'} {u}")

# (compte, partner, chemin, description)
TESTS = [
    ("admin", None, "/api/partenaires", "Liste partenaires + identites"),
    ("admin", None, "/api/admin/audit", "Journal d'audit"),
    ("manager.mc", 2, "/api/partners/2/pos", "POS Master Color"),
    ("manager.mc", 2, "/api/partners/2/dsm", "DSM Master Color"),
    ("manager.mc", 2, "/api/partners/2/sim", "SIM Master Color"),
    ("manager.mc", 2, "/api/partners/2/bts", "BTS Master Color"),
    ("manager.mc", 2, "/api/partners/2/prime-periods", "Periodes de primes MC"),
    ("manager.mc", 2, "/api/partners/2/primes", "Primes MC"),
    ("manager.mc", 2, "/api/partners/2/primes/commissions", "Commissions DSM MC"),
    ("manager.mc", 2, "/api/partners/2/requests/summary", "Requetes MC"),
    ("manager.mc", 2, "/api/partners/2/analytics/dashboard", "Dashboard MC"),
    ("manager.mc", 2, "/api/partners/2/analytics/sales-summary", "Suivi ventes MC"),
    ("manager.mc", 2, "/api/partners/2/analytics/monthly-table", "Tableau mensuel MC"),
    ("manager.mc", 2, "/api/partners/2/analytics/loading-summary", "Chargement MC"),
    ("manager.mc", 2, "/api/partners/2/dsm-objectives?prime_period_id=6", "Objectifs DSM MC"),
    ("manager.mc", 2, "/api/partners/2/prime-grids", "Grilles de primes MC"),
    ("dsm.odi", 4, "/api/partners/4/pos", "POS Odi"),
    ("dsm.odi", 4, "/api/partners/4/dsm", "DSM Odi"),
    ("dsm.odi", 4, "/api/partners/4/sim", "SIM Odi"),
    ("dsm.odi", 4, "/api/partners/4/prime-periods", "Periodes Odi"),
    ("dsm.odi", 4, "/api/partners/4/primes", "Primes Odi"),
    ("dsm.odi", 4, "/api/partners/4/requests/summary", "Requetes Odi"),
    ("dsm.odi", 4, "/api/partners/4/analytics/dashboard", "Dashboard Odi"),
    ("dsm.odi", 4, "/api/partners/4/analytics/sales-summary", "Ventes Odi"),
    ("dsm.odi", 4, "/api/partners/4/prime-grids", "Grilles Odi"),
    ("dsm.odi", 4, "/api/partners/4/dsm-objectives?prime_period_id=27", "Objectifs DSM Odi"),
    ("oper.odi", 4, "/api/partners/4/pos", "POS Odi (scope OPERATIONNEL)"),
    ("dsm.sev", 5, "/api/partners/5/analytics/dashboard", "Dashboard Seven"),
    ("dsm.sev", 5, "/api/partners/5/prime-periods", "Periodes Seven"),
    ("pos.mc02", 2, "/api/partners/2/pos", "POS MC (holder)"),
    ("dsm.mc", 2, "/api/partners/2/analytics/dashboard", "Dashboard MC (dsm.mc)"),
]

print("\n== ENDPOINTS ==")
ok = err = 0
for compte, _, path, desc in TESTS:
    t = tokens.get(compte)
    if not t:
        print(f"  SKIP {desc} ({compte} non connecte)")
        continue
    s, b = req("GET", path, token=t)
    vide = ""
    if s == 200:
        if isinstance(b, dict):
            n = len(b.get("items", [])) if "items" in b else "-"
            vide = f"(items={n})" if n != "-" else "(ok)"
        elif isinstance(b, list):
            vide = f"(n={len(b)})"
        ok += 1
    else:
        err += 1
    print(f"  [{'OK' if s == 200 else s}] {desc} {vide}")

print(f"\nRESULTAT: {ok} OK / {err} erreur(s)")
