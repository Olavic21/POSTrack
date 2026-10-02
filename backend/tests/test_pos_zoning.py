"""Zoning POS VERT / ORANGE / ROUGE fondé sur les données géographiques réelles.

Couvre :
- L'algorithme point-dans-polygone (ray casting) et l'extraction GeoJSON.
- Le classement métier :
    * VERT   : POS dans la micro-zone (polygone) du DSM
    * ORANGE : hors MZ du DSM mais dans le territoire du partenaire
               (affiche la micro-zone trouvée le cas échéant)
    * ROUGE  : hors territoire (affiche le partenaire du territoire)
    * INCONNU: coordonnées GPS absentes
- Les endpoints `/api/partners/{id}/pos/{pos_id}/zoning`,
  `/api/partners/{id}/pos/zoning/preview` et l'exposition du zoning dans
  la liste enrichie `/api/partners/{id}/pos/enriched`.

Aucune géométrie n'est censée être inventée côté serveur : les polygones
utilisés ici sont des carrés de test explicites (≈ 11 km de côté) autour de
Douala, posés puis supprimés par la fixture dédiée.
"""
from datetime import date, timedelta

import pytest

from app.core.database import SessionLocal
from app.models.dsm import DSM
from app.models.partner import MicroZone, Partner
from app.models.pos import POS
from app.services.zoning_service import (
    _get_polygon_coords,
    _point_in_polygon,
    get_pos_zoning,
)
from tests.conftest import auth_headers

# --- Géométries de test ------------------------------------------------------
# Territoire partenaire A : carré 3.95–4.15 lat / 9.60–9.80 lon.
TERRITORY_A = {
    "type": "Polygon",
    "coordinates": [[[9.60, 3.95], [9.80, 3.95], [9.80, 4.15], [9.60, 4.15], [9.60, 3.95]]],
}
# Micro-zone du DSM : carré 4.00–4.10 lat / 9.65–9.75 lon (incluse dans A).
MZ_DSM_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[9.65, 4.00], [9.75, 4.00], [9.75, 4.10], [9.65, 4.10], [9.65, 4.00]]],
}
# Seconde micro-zone du même partenaire : 4.11–4.13 lat / 9.61–9.63 lon.
MZ_OTHER_POLYGON = {
    "type": "Polygon",
    "coordinates": [[[9.61, 4.11], [9.63, 4.11], [9.63, 4.13], [9.61, 4.13], [9.61, 4.11]]],
}
# Territoire partenaire B (voisin lointain, 10.0–10.1) : sert au cas ROUGE
# « le point est dans le territoire d'un autre partenaire ».
TERRITORY_B = {
    "type": "Polygon",
    "coordinates": [[[10.00, 4.00], [10.10, 4.00], [10.10, 4.10], [10.00, 4.10], [10.00, 4.00]]],
}

CODE_A = "CB-ZONETEST-A"
CODE_B = "CB-ZONETEST-B"
MZ_DSM_CODE = "CB-ZONETEST-DSMZ"
MZ_OTHER_CODE = "CB-ZONETEST-2"
DSM_MATRICULE = "CB-ZONETEST-DSM"


def _delete_partners(codes):
    """Supprime les partenaires de test et tout ce qui en dépend."""
    db = SessionLocal()
    try:
        for partner in db.query(Partner).filter(Partner.code.in_(list(codes))).all():
            for pos in db.query(POS).filter(POS.partner_id == partner.id).all():
                db.delete(pos)
            for mz in db.query(MicroZone).filter(MicroZone.partner_id == partner.id).all():
                db.delete(mz)
            for dsm in db.query(DSM).filter(DSM.partner_id == partner.id).all():
                db.delete(dsm)
            db.delete(partner)
        db.commit()
    finally:
        db.close()


@pytest.fixture
def zoning_setup():
    """Partenaire A (2 MZ + DSM) et partenaire B, avec géométries polygonales."""
    _delete_partners((CODE_A, CODE_B))
    db = SessionLocal()
    try:
        partner_a = Partner(code=CODE_A, name="CB Zoning A", territory_geojson=TERRITORY_A)
        partner_b = Partner(code=CODE_B, name="CB Zoning B", territory_geojson=TERRITORY_B)
        db.add_all([partner_a, partner_b])
        db.commit()
        db.refresh(partner_a)
        db.refresh(partner_b)

        mz_dsm = MicroZone(
            partner_id=partner_a.id, name=MZ_DSM_CODE, code=MZ_DSM_CODE,
            latitude=4.05, longitude=9.70, boundaries=MZ_DSM_POLYGON,
        )
        mz_other = MicroZone(
            partner_id=partner_a.id, name=MZ_OTHER_CODE, code=MZ_OTHER_CODE,
            latitude=4.12, longitude=9.62, boundaries=MZ_OTHER_POLYGON,
        )
        db.add_all([mz_dsm, mz_other])
        db.commit()

        dsm = DSM(matricule=DSM_MATRICULE, full_name="CB DSM Zoning",
                  partner_id=partner_a.id, zone=MZ_DSM_CODE)
        db.add(dsm)
        db.commit()
        db.refresh(dsm)

        ids = {"a": partner_a.id, "b": partner_b.id, "dsm": dsm.id, "mz_dsm": mz_dsm.id}
    finally:
        db.close()

    yield ids
    _delete_partners((CODE_A, CODE_B))


def _transient_pos(setup, lat=None, lon=None, zone=None):
    """POS non persisté : get_pos_zoning n'utilise que partner_id/dsm_id/GPS."""
    return POS(
        code_pos="CB-ZONETEST-POS", name="POS Zoning",
        partner_id=setup["a"], dsm_id=setup["dsm"],
        latitude=lat, longitude=lon, zone=zone,
        date_creation=date.today(), date_expiration=date.today() + timedelta(days=365),
    )


# --- Algorithme point-dans-polygone -----------------------------------------

def test_point_in_polygon_inside_and_outside():
    ring = MZ_DSM_POLYGON["coordinates"]
    assert _point_in_polygon(4.05, 9.70, ring) is True   # centre
    assert _point_in_polygon(4.50, 9.70, ring) is False  # hors lat
    assert _point_in_polygon(4.05, 9.99, ring) is False  # hors lon


def test_point_in_polygon_rejects_degenerate_inputs():
    assert _point_in_polygon(4.05, 9.70, []) is False
    assert _point_in_polygon(4.05, 9.70, None) is False
    # Anneau de moins de 3 sommets distincts : non exploitable.
    assert _point_in_polygon(4.05, 9.70, [[[9.65, 4.00], [9.75, 4.00]]]) is False


def test_get_polygon_coords_accepts_polygon_multipolygon_and_list():
    assert _get_polygon_coords(TERRITORY_A) == TERRITORY_A["coordinates"]
    multi = {"type": "MultiPolygon", "coordinates": [TERRITORY_A["coordinates"]]}
    assert _get_polygon_coords(multi) == TERRITORY_A["coordinates"]
    assert _get_polygon_coords(TERRITORY_A["coordinates"]) == TERRITORY_A["coordinates"]
    assert _get_polygon_coords(None) is None


# --- Classement métier (service) --------------------------------------------

def test_zoning_vert_when_inside_dsm_microzone(zoning_setup):
    db = SessionLocal()
    try:
        res = get_pos_zoning(db, _transient_pos(zoning_setup, lat=4.05, lon=9.70))
    finally:
        db.close()
    assert res["status"] == "VERT"
    assert res["color"] == "green"
    assert res["micro_zone"] == MZ_DSM_CODE
    assert res["partner_name"] == "CB Zoning A"


def test_zoning_orange_when_in_other_microzone_of_same_partner(zoning_setup):
    db = SessionLocal()
    try:
        res = get_pos_zoning(db, _transient_pos(zoning_setup, lat=4.12, lon=9.62))
    finally:
        db.close()
    assert res["status"] == "ORANGE"
    assert res["color"] == "orange"
    assert res["micro_zone"] == MZ_OTHER_CODE


def test_zoning_orange_when_in_partner_territory_without_microzone(zoning_setup):
    # Point dans le territoire A mais hors des deux micro-zones.
    db = SessionLocal()
    try:
        res = get_pos_zoning(db, _transient_pos(zoning_setup, lat=4.12, lon=9.78))
    finally:
        db.close()
    assert res["status"] == "ORANGE"
    assert res["micro_zone"] is None
    assert res["partner_name"] == "CB Zoning A"


def test_zoning_rouge_when_outside_all_territories(zoning_setup):
    db = SessionLocal()
    try:
        res = get_pos_zoning(db, _transient_pos(zoning_setup, lat=6.50, lon=3.40))
    finally:
        db.close()
    assert res["status"] == "ROUGE"
    assert res["color"] == "red"


def test_zoning_rouge_names_the_other_partner_territory(zoning_setup):
    # Le point est dans le territoire du partenaire B : ROUGE pour A, avec B nommé.
    db = SessionLocal()
    try:
        res = get_pos_zoning(db, _transient_pos(zoning_setup, lat=4.05, lon=10.05))
    finally:
        db.close()
    assert res["status"] == "ROUGE"
    assert res["partner_name"] == "CB Zoning B"


def test_zoning_inconnu_without_gps(zoning_setup):
    db = SessionLocal()
    try:
        res = get_pos_zoning(db, _transient_pos(zoning_setup))
    finally:
        db.close()
    assert res["status"] == "INCONNU"
    assert "GPS" in res["detail"]


def test_zoning_vert_fallback_on_matching_zone_string():
    """Sans polygone exploitable, l'égalité POS.zone == DSM.zone classe VERT."""
    db = SessionLocal()
    try:
        partner = Partner(code="CB-ZONETEST-C", name="CB Zoning C")
        db.add(partner)
        db.commit()
        db.refresh(partner)
        dsm = DSM(matricule="CB-ZONETEST-DSM-C", full_name="CB DSM C",
                  partner_id=partner.id, zone="CB-ZONE-STR")
        db.add(dsm)
        db.commit()
        db.refresh(dsm)

        pos = POS(code_pos="CB-ZONETEST-C1", name="POS C", partner_id=partner.id,
                  dsm_id=dsm.id, latitude=4.05, longitude=9.70, zone="CB-ZONE-STR",
                  date_creation=date.today(), date_expiration=date.today() + timedelta(days=365))
        res = get_pos_zoning(db, pos)
    finally:
        db.close()
        _delete_partners(("CB-ZONETEST-C",))
    assert res["status"] == "VERT"
    assert res["detail"].startswith("Zone POS")


# --- Endpoints API ----------------------------------------------------------

def _create_pos(client, token, setup, code, lat=None, lon=None):
    payload = {
        "code_pos": code,
        "name": f"POS {code}",
        "dsm_id": setup["dsm"],
        "date_creation": str(date.today()),
        "date_expiration": str(date.today() + timedelta(days=365)),
    }
    if lat is not None:
        payload["latitude"] = lat
    if lon is not None:
        payload["longitude"] = lon
    resp = client.post(
        f"/api/partners/{setup['a']}/pos", json=payload, headers=auth_headers(token)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_zoning_endpoint_for_existing_pos(client, rep1_token, zoning_setup):
    pos_id = _create_pos(client, rep1_token, zoning_setup, "CB-ZONETEST-E1", lat=4.05, lon=9.70)
    resp = client.get(
        f"/api/partners/{zoning_setup['a']}/pos/{pos_id}/zoning",
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "VERT"


def test_zoning_endpoint_inconnu_without_coordinates(client, rep1_token, zoning_setup):
    pos_id = _create_pos(client, rep1_token, zoning_setup, "CB-ZONETEST-E2")
    resp = client.get(
        f"/api/partners/{zoning_setup['a']}/pos/{pos_id}/zoning",
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "INCONNU"


def test_zoning_preview_endpoint(client, rep1_token, zoning_setup):
    resp = client.get(
        f"/api/partners/{zoning_setup['a']}/pos/zoning/preview",
        params={"latitude": 4.05, "longitude": 9.70, "dsm_id": zoning_setup["dsm"]},
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "VERT"

    # Sans coordonnées, la preview répond INCONNU (jamais 500).
    empty = client.get(
        f"/api/partners/{zoning_setup['a']}/pos/zoning/preview",
        headers=auth_headers(rep1_token),
    )
    assert empty.status_code == 200
    assert empty.json()["status"] == "INCONNU"


def test_enriched_list_exposes_zoning(client, rep1_token, zoning_setup):
    _create_pos(client, rep1_token, zoning_setup, "CB-ZONETEST-E3", lat=4.12, lon=9.62)
    resp = client.get(
        f"/api/partners/{zoning_setup['a']}/pos/enriched",
        headers=auth_headers(rep1_token),
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert items, "la liste enrichie doit contenir le POS créé"
    statuses = {item.get("zoning", {}).get("status") for item in items}
    assert "ORANGE" in statuses
