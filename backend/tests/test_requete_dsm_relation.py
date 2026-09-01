"""Tests pour la relation requêtes-DSM et les nouvelles fonctionnalités."""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.models.requete import Requete, TypeRequete, PrioriteRequete
from app.models.partner import Partner
from app.models.dsm import DSM
from app.models.user import User, Role
from app.services.requete_service import (
    _calculate_request_status,
    _calculate_delay,
    _is_late,
    enrich_requete_summary,
    get_requetes_by_dsm,
    get_dsm_request_summary,
)


@pytest.fixture
def test_partner(db: Session):
    """Crée un partenaire de test."""
    partner = db.query(Partner).filter(Partner.code == "TEST_PARTNER_REQ").first()
    if not partner:
        partner = Partner(
            code="TEST_PARTNER_REQ",
            name="Partenaire Test Requêtes",
            is_active=True,
        )
        db.add(partner)
        db.commit()
        db.refresh(partner)
    return partner


@pytest.fixture
def test_dsm(db: Session, test_partner):
    """Crée un DSM de test."""
    dsm = db.query(DSM).filter(DSM.matricule == "DSM_REQ_001").first()
    if not dsm:
        dsm = DSM(
            partner_id=test_partner.id,
            matricule="DSM_REQ_001",
            full_name="Test DSM Requêtes",
        )
        db.add(dsm)
        db.commit()
        db.refresh(dsm)
    return dsm


@pytest.fixture
def test_user(db: Session):
    """Crée un utilisateur de test."""
    user = db.query(User).filter(User.email == "user@test.com").first()
    if not user:
        user = User(
            username="test_user_req",
            email="user@test.com",
            full_name="Test User",
            role=Role.OPERATIONNEL,
            is_active=True,
        )
        user.set_password("password123")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def test_calculate_request_status_en_cours(db: Session, test_partner, test_user):
    """Test le calcul de statut pour une requête en cours."""
    requete = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test requête en cours",
        demandeur_id=test_user.id,
        nombre_demande=10,
        nombre_effectue=5,
        nombre_rejete=2,
        date_creation=datetime.now(timezone.utc),
    )
    db.add(requete)
    db.commit()

    statut = _calculate_request_status(requete)
    assert statut == "En cours"


def test_calculate_request_status_terminee(db: Session, test_partner, test_user):
    """Test le calcul de statut pour une requête terminée."""
    requete = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test requête terminée",
        demandeur_id=test_user.id,
        nombre_demande=10,
        nombre_effectue=8,
        nombre_rejete=2,
        date_creation=datetime.now(timezone.utc),
        date_finalisation=datetime.now(timezone.utc),
    )
    db.add(requete)
    db.commit()

    statut = _calculate_request_status(requete)
    assert statut == "Terminée"


def test_calculate_delay(db: Session, test_partner, test_user):
    """Test le calcul du délai d'attente."""
    date_creation = datetime.now(timezone.utc) - timedelta(days=5)
    requete = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test délai",
        demandeur_id=test_user.id,
        date_creation=date_creation,
    )
    db.add(requete)
    db.commit()

    delai = _calculate_delay(requete)
    assert delai is not None
    assert delai >= 4  # Environ 5 jours


def test_is_late_en_retard(db: Session, test_partner, test_user):
    """Test la détection de requêtes en retard."""
    date_creation = datetime.now(timezone.utc) - timedelta(days=10)
    requete = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test en retard",
        demandeur_id=test_user.id,
        date_creation=date_creation,
        delai=7,  # Délai de 7 jours
    )
    db.add(requete)
    db.commit()

    is_late = _is_late(requete)
    assert is_late is True


def test_is_late_pas_en_retard(db: Session, test_partner, test_user):
    """Test qu'une requête récente n'est pas en retard."""
    date_creation = datetime.now(timezone.utc) - timedelta(days=2)
    requete = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test pas en retard",
        demandeur_id=test_user.id,
        date_creation=date_creation,
    )
    db.add(requete)
    db.commit()

    is_late = _is_late(requete)
    assert is_late is False


def test_enrich_requete_summary_with_dsm(db: Session, test_partner, test_dsm, test_user):
    """Test l'enrichissement d'une requête avec les informations DSM."""
    requete = Requete(
        partner_id=test_partner.id,
        dsm_id=test_dsm.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test enrichissement",
        demandeur_id=test_user.id,
        nombre_demande=5,
        nombre_effectue=3,
        date_creation=datetime.now(timezone.utc),
    )
    db.add(requete)
    db.commit()

    enriched = enrich_requete_summary(db, requete)

    assert enriched["dsm_id"] == test_dsm.id
    assert enriched["dsm_name"] == test_dsm.full_name
    assert enriched["demandeur_name"] == test_user.full_name
    assert enriched["statut"] == "En cours"
    assert "delai_attente" in enriched
    assert "en_retard" in enriched


def test_get_requetes_by_dsm(db: Session, test_partner, test_dsm, test_user):
    """Test la récupération des requêtes spécifiques à un DSM."""
    # Créer des requêtes pour le DSM
    for i in range(3):
        requete = Requete(
            partner_id=test_partner.id,
            dsm_id=test_dsm.id,
            type_requete=TypeRequete.AJOUT,
            titre=f"Requête DSM {i}",
            demandeur_id=test_user.id,
            nombre_demande=5,
            nombre_effectue=i,
            date_creation=datetime.now(timezone.utc),
        )
        db.add(requete)
    
    # Créer une requête sans DSM
    requete_sans_dsm = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Requête sans DSM",
        demandeur_id=test_user.id,
        nombre_demande=5,
        nombre_effectue=0,
        date_creation=datetime.now(timezone.utc),
    )
    db.add(requete_sans_dsm)
    
    db.commit()

    requetes_dsm = get_requetes_by_dsm(db, test_partner.id, test_dsm.id)
    
    assert len(requetes_dsm) == 3
    for req in requetes_dsm:
        assert req.dsm_id == test_dsm.id


def test_get_dsm_request_summary(db: Session, test_partner, test_dsm, test_user):
    """Test le résumé des requêtes pour un DSM."""
    # Créer des requêtes avec différents statuts
    requete_en_cours = Requete(
        partner_id=test_partner.id,
        dsm_id=test_dsm.id,
        type_requete=TypeRequete.AJOUT,
        titre="En cours",
        demandeur_id=test_user.id,
        nombre_demande=10,
        nombre_effectue=5,
        date_creation=datetime.now(timezone.utc),
    )
    db.add(requete_en_cours)
    
    requete_terminee = Requete(
        partner_id=test_partner.id,
        dsm_id=test_dsm.id,
        type_requete=TypeRequete.RECONDUCTION,
        titre="Terminée",
        demandeur_id=test_user.id,
        nombre_demande=5,
        nombre_effectue=5,
        date_creation=datetime.now(timezone.utc),
        date_finalisation=datetime.now(timezone.utc),
    )
    db.add(requete_terminee)
    
    requete_en_retard = Requete(
        partner_id=test_partner.id,
        dsm_id=test_dsm.id,
        type_requete=TypeRequete.AJOUT,
        titre="En retard",
        demandeur_id=test_user.id,
        nombre_demande=5,
        nombre_effectue=0,
        date_creation=datetime.now(timezone.utc) - timedelta(days=10),
        delai=7,
    )
    db.add(requete_en_retard)
    
    db.commit()

    summary = get_dsm_request_summary(db, test_partner.id, test_dsm.id)
    
    assert summary["total"] == 3
    assert summary["en_cours"] == 2  # en cours + en retard
    assert summary["terminees"] == 1
    assert summary["en_retard"] == 1
    assert summary["progression"] == pytest.approx(33.33, rel=0.1)  # 1/3
    assert len(summary["requetes"]) == 3


def test_requete_sans_dsm(db: Session, test_partner, test_user):
    """Test qu'une requête sans DSM fonctionne correctement."""
    requete = Requete(
        partner_id=test_partner.id,
        type_requete=TypeRequete.AJOUT,
        titre="Test sans DSM",
        demandeur_id=test_user.id,
        nombre_demande=5,
        nombre_effectue=3,
        date_creation=datetime.now(timezone.utc),
    )
    db.add(requete)
    db.commit()

    enriched = enrich_requete_summary(db, requete)
    
    assert enriched["dsm_id"] is None
    assert enriched["dsm_name"] is None
    assert enriched["statut"] == "En cours"


def test_api_summary_filters_by_dsm(client, admin_token, seed):
    """Test que l'endpoint summary accepte le paramètre dsm_id."""
    from tests.conftest import auth_headers
    
    # Créer un DSM supplémentaire pour le test
    dsm_response = client.post(
        f"/api/partners/{seed['p1']}/dsm",
        json={"matricule": "DSM_TEST_001", "full_name": "DSM Test Filtre"},
        headers=auth_headers(admin_token)
    )
    assert dsm_response.status_code == 201
    dsm_id = dsm_response.json()["id"]
    
    # Tester que le paramètre dsm_id est accepté par l'endpoint
    summary_filtre = client.get(
        f"/api/partners/{seed['p1']}/requests/summary",
        params={"dsm_id": dsm_id},
        headers=auth_headers(admin_token)
    )
    assert summary_filtre.status_code == 200
    body = summary_filtre.json()
    
    # Vérifier la structure de la réponse
    assert "items" in body
    assert "total" in body
    # Les items retournés doivent avoir le dsm_id spécifié (s'il y en a)
    for item in body["items"]:
        assert item["dsm_id"] == dsm_id