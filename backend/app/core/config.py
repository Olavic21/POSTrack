"""
Configuration centrale de l'application, chargee depuis les variables
d'environnement (.env). Toute constante partagee par plusieurs modules
doit etre ajoutee ici plutot que dupliquee.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "POSTrack API"
    VERSION: str = "4.0 (Jour 14 - version finale)"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "sqlite:///./postrack.db"

    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Origines autorisees pour le CORS, separees par des virgules (ex:
    # "https://app.postrack.cm,https://admin.postrack.cm"). "*" (valeur
    # par defaut) convient au developpement local mais DOIT etre
    # restreint a la ou les origines reelles du frontend en production
    # -- un wildcard n'est de toute facon jamais combine avec les
    # cookies/credentials (voir app/main.py).
    ALLOWED_ORIGINS: str = "*"

    # Seuils BTS configurables (modifiables sans rewrite)
    # Saturé >= BTS_SATURATION_THRESHOLD, Presque saturé >= BTS_ALMOST_SATURATED_THRESHOLD
    BTS_SATURATION_THRESHOLD: float = 80.0
    BTS_ALMOST_SATURATED_THRESHOLD: float = 70.0

    # --- Phase 3B : règles métier primes DSM (source de vérité backend) ---
    # PU = POS (le cahier utilise « PU inscrits » pour les POS créés).
    # Objectifs mensuels par défaut utilisés lorsqu'aucun DSMObjective
    # n'est défini pour la période (configurables, jamais hardcodés en React).
    DSM_DEFAULT_CREATION_OBJECTIVE: int = 200
    DSM_DEFAULT_REVENUE_OBJECTIVE: float = 500000.0
    # Grille de référence : <75 % → 0 ; 75–<95 % → 0,1 % ; >=95 % → 0,5 %.
    PRIME_THRESHOLD_LOW: float = 75.0
    PRIME_THRESHOLD_HIGH: float = 95.0
    PRIME_RATE_LOW: float = 0.1
    PRIME_RATE_HIGH: float = 0.5

    # Nombre de jours avant expiration a partir duquel un POS declenche
    # une alerte sur le Dashboard Partenaire (Jour 12 de la roadmap)
    POS_EXPIRATION_ALERT_DAYS: int = 30

    # Dossier de stockage des rapports d'import (local, demo)
    IMPORT_REPORTS_DIR: str = "./import_reports"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
