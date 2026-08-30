"""
Point d'entree de l'API POSTrack (version finale - Jour 14, durcie et
optimisee).

Lancement local :
    uvicorn app.main:app --reload

Documentation interactive : http://localhost:8000/docs
"""
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import Base, engine
from app.core.errors import AppError, app_error_handler
from app import models as _all_models  # noqa: F401  (charge tous les modeles avant create_all)

from app.api import auth as auth_router
from app.api import partner_pos, partner_bts, partner_geo, partner_sim, partner_dsm, dsm_geo
from app.api import partner_primes, partner_requests, imports, analytics, admin
from app.api import partner_dsm_objectives, partner_prime_grids
from app.api import hierarchy as hierarchy_router
from app.api import partenaires as partenaires_router
from app.api import users as users_router

class _RequestIdFilter(logging.Filter):
    """Garantit que chaque enregistrement de log possede un request_id
    (les logs emis hors du middleware, ex. au demarrage, n'en ont pas)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
)
# Le filtre doit être posé sur les handlers (pas seulement sur le logger
# racine) : les records émis par d'autres loggers (ex. httpx/uvicorn)
# atteignent les handlers du root sans passer par la chaîne de filtres
# du logger, ce qui provoquerait "Formatting field not found: request_id".
for _handler in logging.getLogger().handlers:
    _handler.addFilter(_RequestIdFilter())
logging.getLogger().addFilter(_RequestIdFilter())
logger = logging.getLogger("postrack")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "API de la plateforme POSTrack : gestion et suivi de la chaine "
        "Partenaire -> DSM -> POS -> Client, avec BTS, SIM, Primes par "
        "periode, Requetes multi-entites et import Excel central."
    ),
)

# CORS : origines pilotees par ALLOWED_ORIGINS (.env). En developpement,
# on tolere "*". Si la configuration est vide ou invalide, on retombe sur
# localhost pour eviter une API inaccessible au navigateur.
_cors_origins = settings.cors_origins or ["http://localhost:5173", "http://127.0.0.1:5173"]
if _cors_origins == ["*"]:
    _allow_credentials = False
else:
    _allow_credentials = True
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compresse les reponses volumineuses (listes paginees, rapports
# d'import) au-dela de 1 Ko -- reduit la bande passante et le temps de
# transfert, notamment utile pour les clients mobiles du reseau POS.
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next):
    """
    Attribue un identifiant unique a chaque requete (utile pour
    correler les logs et le support), et journalise sa duree -- point
    d'observation minimal pour verifier en continu l'exigence de
    performance du cahier des charges (p95 < 500 ms sur les lectures
    usuelles du dashboard).
    """
    request_id = uuid.uuid4().hex[:12]
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method, request.url.path, response.status_code, duration_ms,
        extra={"request_id": request_id},
    )
    return response


app.add_exception_handler(AppError, app_error_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Filet de securite pour toute exception non prevue (ex. erreur
    d'integrite base de donnees non convertie en AppError) : renvoie
    une reponse 500 generique sans exposer la trace interne au client,
    tout en journalisant l'erreur complete cote serveur pour le
    diagnostic.
    """
    logger.exception("Erreur non geree sur %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erreur interne du serveur.", "field": None})


# En demo/developpement (SQLite) : cree les tables si elles n'existent
# pas encore, pour un demarrage a zero configuration. En production
# (MySQL), le schema est gere par Alembic (voir README + migrations/) ;
# create_all() est alors un no-op inoffensif si les migrations ont deja
# ete appliquees (il ne fait qu'ajouter les tables manquantes).
Base.metadata.create_all(bind=engine)

app.include_router(auth_router.router)
app.include_router(partner_pos.router)
app.include_router(partner_bts.router)
app.include_router(partner_geo.router)
app.include_router(partner_dsm.router)
app.include_router(dsm_geo.router)
app.include_router(partner_sim.router)
app.include_router(partner_primes.router)
app.include_router(partner_primes.periods_router)
app.include_router(partner_requests.router)
app.include_router(imports.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(partner_dsm_objectives.router)
app.include_router(partner_prime_grids.router)
app.include_router(users_router.router)
app.include_router(hierarchy_router.router)
app.include_router(partenaires_router.router)


@app.get("/", tags=["Sante"])
def root():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}


@app.get("/health", tags=["Sante"])
def health():
    return {"status": "healthy"}
