"""Fixtures partagees pour la suite de tests POSTrack."""
import os
import sys
from datetime import date, timedelta

TEST_DB_FILE = "test_postrack.db"
os.environ["DATABASE_URL"] = f"sqlite:///./{TEST_DB_FILE}"
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except PermissionError:
        pass

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal, Base, engine
from app import models as _all_models  # noqa: F401
from app.main import app
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.user import User
from app.models.pos import POS, TypePos
from app.models.prime_period import PrimePeriod, StatutPeriode
from app.security.password import hash_password
from app.security.permissions import Role

TEST_PASSWORD = "Pwd@Test1234"


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except PermissionError:
            pass


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def seed():
    db = SessionLocal()
    p1 = Partner(code="T-P1", name="Partenaire Test Un")
    p2 = Partner(code="T-P2", name="Partenaire Test Deux")
    db.add_all([p1, p2])
    db.commit()
    db.refresh(p1)
    db.refresh(p2)

    dsm1 = DSM(matricule="T-DSM1", full_name="DSM Test Un", partner_id=p1.id)
    db.add(dsm1)
    db.commit()
    db.refresh(dsm1)

    admin = User(username="t_admin", email="t_admin@test.cm", role=Role.ADMIN, hashed_password=hash_password(TEST_PASSWORD))
    manager = User(username="t_manager", email="t_manager@test.cm", role=Role.MANAGER, hashed_password=hash_password(TEST_PASSWORD))
    chef = User(username="t_chef", email="t_chef@test.cm", role=Role.CHEF_OPERATIONNEL, hashed_password=hash_password(TEST_PASSWORD))
    oper = User(username="t_oper", email="t_oper@test.cm", role=Role.OPERATIONNEL, partner_id=p1.id, hashed_password=hash_password(TEST_PASSWORD))
    rep1 = User(username="t_rep1", email="t_rep1@test.cm", role=Role.CHEF_OPERATIONNEL, hashed_password=hash_password(TEST_PASSWORD))
    dsm_user = User(username="t_dsm1", email="t_dsm1@test.cm", role=Role.OPERATIONNEL, partner_id=p1.id, hashed_password=hash_password(TEST_PASSWORD))
    db.add_all([admin, manager, chef, oper, rep1, dsm_user])
    db.commit()
    for u in (admin, manager, chef, oper, rep1, dsm_user):
        db.refresh(u)

    today = date.today()
    pos1 = POS(code_pos="T-POS-1", name="POS Test Un", partner_id=p1.id, dsm_id=dsm1.id, type_pos=TypePos.NOUVEAU, date_creation=today, date_expiration=today + timedelta(days=300), stock_initial=10, stock_actuel=10)
    db.add(pos1)
    db.commit()
    db.refresh(pos1)

    period = PrimePeriod(partner_id=p1.id, code="T-PER1", label="Periode Test", start_date=today, end_date=today + timedelta(days=30), status=StatutPeriode.OPEN)
    db.add(period)
    db.commit()
    db.refresh(period)

    data = {
        "p1": p1.id, "p2": p2.id, "dsm1": dsm1.id,
        "pos1": pos1.id, "period": period.id,
        "admin_id": admin.id, "manager_id": manager.id, "chef_id": chef.id, "oper_id": oper.id,
        "rep1_id": rep1.id, "dsm1_user_id": dsm_user.id,
    }
    db.close()
    return data


def _login(client, username):
    resp = client.post("/api/auth/login", json={"username": username, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(client, seed):
    return _login(client, "t_admin")


@pytest.fixture(scope="session")
def manager_token(client, seed):
    return _login(client, "t_manager")


@pytest.fixture(scope="session")
def chef_token(client, seed):
    return _login(client, "t_chef")


@pytest.fixture(scope="session")
def oper_token(client, seed):
    return _login(client, "t_oper")


@pytest.fixture(scope="session")
def rep1_token(client, seed):
    return _login(client, "t_rep1")


@pytest.fixture(scope="session")
def dsm1_token(client, seed):
    """Jeton du compte OPERATIONNEL rattache au Partenaire p1 (cote DSM)."""
    return _login(client, "t_dsm1")


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
@pytest.fixture(scope="session")
def client_p2_pos(client, admin_token, seed):
    """Un POS cree dans le Partenaire p2 (hors perimetre de l'OPERATIONNEL de p1)."""
    db = SessionLocal()
    dsm2 = DSM(matricule="T-DSM2", full_name="DSM Test Deux", partner_id=seed["p2"])
    db.add(dsm2)
    db.commit()
    db.refresh(dsm2)
    db.close()

    payload = {
        "code_pos": "T-POS-P2-1",
        "name": "POS du Partenaire Deux",
        "dsm_id": dsm2.id,
        "date_creation": str(date.today()),
        "date_expiration": str(date.today() + timedelta(days=200)),
    }
    resp = client.post(f"/api/partners/{seed['p2']}/pos", json=payload, headers=auth_headers(admin_token))
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.fixture
def db():
    """Fixture de base de donnees pour les tests unitaires.

    Utilise une transaction de connexion pour isoler chaque test.
    ROLLBACK a la fin du test pour garantir l'isolation.
    """
    from sqlalchemy.orm import sessionmaker
    connection = engine.connect()
    transaction = connection.begin()
    db = sessionmaker(bind=connection)()
    try:
        yield db
    finally:
        db.close()
        transaction.rollback()
        connection.close()
