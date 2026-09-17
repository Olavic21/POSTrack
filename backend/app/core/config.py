"""
Configuration centrale de l'application, chargee depuis les variables
d'environnement (.env). Toute constante partagee par plusieurs modules
doit etre ajoutee ici plutot que dupliquee.
"""
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base absolue = dossier backend/ (parent de app/), pour que
# DATABASE_URL relatif pointe toujours vers backend/postrack.db
# quel que soit le cwd (uvicorn depuis backend/ ou racine).
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_DEFAULT_DB_URL = f"sqlite:///{(_BACKEND_DIR / 'postrack.db').as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "POSTrack API"
    VERSION: str = "4.0 (Jour 14 - version finale)"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = _DEFAULT_DB_URL

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def _normalize_sqlite_url(cls, v: str) -> str:
        """Force tout sqlite relatif (./postrack.db) à pointer vers backend/postrack.db absolu."""
        if isinstance(v, str) and v.startswith("sqlite"):
            # Cas env = sqlite:///./postrack.db  ou sqlite:///postrack.db
            # On ne touche pas aux URLs mémoire (:memory:) ni aux URLs déjà absolues Windows/Unix
            if v in ("sqlite://", "sqlite:///:memory:", "sqlite:///./:memory:"):
                return v
            # Détecte relatif : contient "./" ou pas de chemin absolu après sqlite:///
            # sqlite:///./postrack.db -> backend/postrack.db
            # sqlite:///postrack.db   -> backend/postrack.db (relatif)
            # sqlite:///C:/...         -> déjà absolu (contient : ou commence par /)
            prefix = "sqlite:///"
            if v.startswith(prefix):
                path_part = v[len(prefix):]
                # Déjà absolu si contient ":" (Windows) ou commence par "/"
                is_abs = ":" in path_part or path_part.startswith("/")
                if not is_abs and path_part not in ("", ":memory:"):
                    # Relatif → résoudre vers backend absolu
                    # Nettoie "./" préfixe
                    clean = path_part.lstrip("./")
                    if not clean:
                        clean = "postrack.db"
                    abs_path = (_BACKEND_DIR / clean).as_posix()
                    return f"sqlite:///{abs_path}"
        return v

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

    # --- Prime DSM — règle officielle POSTrack (refonte 2026-09 — correctif 118) ---
    # PU = POS (le cahier utilise « PU inscrits » pour les POS créés).
    # Objectif individuel DSM : 2 POS / mois + 500 000 FCFA recettes 1ère recharge / mois
    # Objectif global partenaire = somme des objectifs DSM (59 DSM × 2 = 118 POS ; 59 × 500 000 = 29 500 000 FCFA)
    # L'ancien global 110 POS est ABANDONNÉ — ne plus utiliser 110 comme cible partenaire.
    # PARTNER_GLOBAL_CREATION_TARGET conservé pour compatibilité mais la source de vérité
    # est désormais la somme des DSMObjective (ou nb_DSM × 2) — voir dsm_prime_calculation_service.
    PARTNER_GLOBAL_CREATION_TARGET: int = 118
    DSM_DEFAULT_CREATION_OBJECTIVE: int = 2
    DSM_DEFAULT_REVENUE_OBJECTIVE: float = 500000.0
    # Grille officielle : <75 % → 0 % ; [75,85) → 5 % ; [85,95) → 6 % ; [95,+∞) → 7 %.
    PRIME_THRESHOLD_LOW: float = 75.0
    PRIME_THRESHOLD_MID: float = 85.0
    PRIME_THRESHOLD_HIGH: float = 95.0
    PRIME_RATE_LOW: float = 5.0
    PRIME_RATE_MID: float = 6.0
    PRIME_RATE_HIGH: float = 7.0

    # Nombre de jours avant expiration a partir duquel un POS declenche
    # une alerte sur le Dashboard Partenaire (Jour 12 de la roadmap)
    POS_EXPIRATION_ALERT_DAYS: int = 30

    # Dossier de stockage des rapports d'import (local, demo)
    IMPORT_REPORTS_DIR: str = "./import_reports"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
