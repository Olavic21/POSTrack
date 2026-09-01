"""Tests pour les nouvelles fonctionnalités de recettes et objectifs de vente."""
import pytest
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.partner import Partner, PartnerSalesTarget
from app.models.user import User, Role
from app.services.analytics_service import (
    get_partner_sales_summary,
    get_dsm_summary,
    create_or_update_sales_target,
)


@pytest.fixture
def test_partner(db: Session):
    """Crée un partenaire de test."""
    partner = db.query(Partner).filter(Partner.code == "TEST_PARTNER").first()
    if not partner:
        partner = Partner(
            code="TEST_PARTNER",
            name="Partenaire Test Recettes",
            is_active=True,
        )
        db.add(partner)
        db.commit()
        db.refresh(partner)
    return partner


@pytest.fixture
def test_admin_user(db: Session):
    """Crée un utilisateur admin pour les tests."""
    user = db.query(User).filter(User.email == "admin@test.com").first()
    if not user:
        user = User(
            username="admin_test_rev",
            email="admin@test.com",
            full_name="Admin Test",
            role=Role.ADMIN,
            is_active=True,
        )
        user.set_password("password123")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def test_sales_summary_with_revenue_target(db: Session, test_partner):
    """Test que le résumé des ventes inclut l'objectif de recettes global."""
    # Créer un objectif de vente avec recette cible
    target = PartnerSalesTarget(
        partner_id=test_partner.id,
        month=date.today().replace(day=1),
        creation_target=100,
        redeployment_target=50,
        sell_out_target=200,
        loading_target=150,
        revenue_target=10000000,  # 10 millions FCFA
        creation_stock_initial=80,
        redeployment_stock_initial=40,
    )
    db.add(target)
    db.commit()

    # Récupérer le résumé des ventes
    summary = get_partner_sales_summary(db, test_partner.id)

    # Vérifier que la structure inclut revenue_global
    assert "revenue_global" in summary
    assert summary["revenue_global"]["objectif"] == 10000000
    assert summary["revenue_global"]["realisation"] is None  # Donnée manquante
    assert summary["revenue_global"]["progression"] is None  # Non calculable sans réalisation


def test_sales_summary_without_revenue_target(db: Session, test_partner):
    """Test que le résumé fonctionne sans objectif de recettes."""
    # Créer un objectif sans revenue_target
    target = PartnerSalesTarget(
        partner_id=test_partner.id,
        month=date.today().replace(day=1),
        creation_target=100,
        sell_out_target=200,
    )
    db.add(target)
    db.commit()

    summary = get_partner_sales_summary(db, test_partner.id)

    # Vérifier que revenue_global existe mais avec None
    assert "revenue_global" in summary
    assert summary["revenue_global"]["objectif"] is None
    assert summary["revenue_global"]["realisation"] is None
    assert summary["revenue_global"]["progression"] is None


def test_create_sales_target_with_revenue(db: Session, test_partner):
    """Test la création d'objectif avec revenue_target."""
    payload = {
        "month": date.today().replace(day=1),
        "creation_target": 100,
        "redeployment_target": 50,
        "sell_out_target": 200,
        "loading_target": 150,
        "revenue_target": 15000000,  # 15 millions FCFA
        "creation_stock_initial": 80,
        "redeployment_stock_initial": 40,
    }

    target = create_or_update_sales_target(db, partner_id=test_partner.id, payload=payload)

    assert target.revenue_target == 15000000
    assert target.creation_target == 100
    assert target.sell_out_target == 200


def test_update_sales_target_revenue(db: Session, test_partner):
    """Test la mise à jour de revenue_target."""
    # Créer l'objectif initial
    initial_payload = {
        "month": date.today().replace(day=1),
        "creation_target": 100,
        "revenue_target": 10000000,
    }
    create_or_update_sales_target(db, partner_id=test_partner.id, payload=initial_payload)

    # Mettre à jour avec un nouveau revenue_target
    update_payload = {
        "month": date.today().replace(day=1),
        "creation_target": 150,
        "revenue_target": 20000000,  # 20 millions FCFA
    }
    updated_target = create_or_update_sales_target(db, partner_id=test_partner.id, payload=update_payload)

    assert updated_target.revenue_target == 20000000
    assert updated_target.creation_target == 150


def test_dsm_summary_structure(db: Session, test_partner):
    """Test que le résumé DSM a la structure correcte avec recettes."""
    from app.models.dsm import DSM

    # Créer un DSM de test
    dsm = DSM(
        partner_id=test_partner.id,
        matricule="DSM001",
        full_name="Test DSM",
    )
    db.add(dsm)
    db.commit()

    # Récupérer le résumé DSM
    dsm_summary = get_dsm_summary(db, test_partner.id)

    # Vérifier la structure
    assert "partner_id" in dsm_summary
    assert "partner_name" in dsm_summary
    assert "by_dsm" in dsm_summary
    assert isinstance(dsm_summary["by_dsm"], list)

    # Vérifier que chaque ligne DSM a les champs requis
    if dsm_summary["by_dsm"]:
        dsm_row = dsm_summary["by_dsm"][0]
        assert "dsm_id" in dsm_row
        assert "dsm_code" in dsm_row
        assert "dsm_name" in dsm_row
        assert "objectif_creation" in dsm_row
        assert "realisation_creation" in dsm_row
        assert "objectif_redeploiement" in dsm_row
        assert "realisation_redeploiement" in dsm_row
        assert "loading" in dsm_row
        assert "sell_out" in dsm_row
        assert "recettes" in dsm_row  # Donnée manquante identifiée
        assert "progression_globale" in dsm_row


def test_dsm_summary_revenues_missing_data(db: Session, test_partner):
    """Test que les recettes DSM sont marquées comme manquantes."""
    from app.models.dsm import DSM

    # Créer un DSM de test
    dsm = DSM(
        partner_id=test_partner.id,
        matricule="DSM002",
        full_name="Test DSM 2",
    )
    db.add(dsm)
    db.commit()

    dsm_summary = get_dsm_summary(db, test_partner.id)

    # Vérifier que les recettes sont None (donnée manquante)
    if dsm_summary["by_dsm"]:
        dsm_row = dsm_summary["by_dsm"][0]
        assert dsm_row["recettes"] is None  # Donnée manquante identifiée


def test_revenue_progression_calculation(db: Session, test_partner):
    """Test le calcul de progression quand les données de recettes sont disponibles."""
    # Créer un objectif avec revenue_target
    target = PartnerSalesTarget(
        partner_id=test_partner.id,
        month=date.today().replace(day=1),
        revenue_target=10000000,
    )
    db.add(target)
    db.commit()

    # Simuler une réalisation (quand les données seront disponibles)
    # Pour l'instant, testons avec None
    summary = get_partner_sales_summary(db, test_partner.id)

    # La progression devrait être None car la réalisation est None
    assert summary["revenue_global"]["progression"] is None

    # Quand les données seront disponibles, on pourra tester:
    # summary["revenue_global"]["realisation"] = 7500000
    # progression attendue = 75%