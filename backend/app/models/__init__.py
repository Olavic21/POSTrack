"""Regroupe tous les modeles SQLAlchemy afin que Base.metadata les connaisse.

Importer ce module suffit a charger l'ensemble du schema.
"""
from app.models.user import User, UserPartner, UserPOS  # noqa: F401
from app.models.partner import Partner, MicroZone, PartnerSalesTarget  # noqa: F401
from app.models.dsm import DSM  # noqa: F401
from app.models.pos import POS, TypePos, StatutPos  # noqa: F401
from app.models.reconduction import Reconduction  # noqa: F401
from app.models.pos_performance import POSPerformance  # noqa: F401
from app.models.prime_period import PrimePeriod, StatutPeriode  # noqa: F401
from app.models.prime import Prime, StatutPrime  # noqa: F401
from app.models.dsm_commission import DSMCommission  # noqa: F401
from app.models.dsm_objective import DSMObjective  # noqa: F401
from app.models.prime_grid import PrimeGrid, GridType  # noqa: F401
from app.models.prime_grid_threshold import PrimeGridThreshold  # noqa: F401
from app.models.sim import SIM, StatutSim, SIMMovement, TypeMouvementSim  # noqa: F401
from app.models.bts import BTS  # noqa: F401
from app.models.bts_releve import BTSReleve  # noqa: F401
from app.models.requete import (  # noqa: F401
    Requete, RequeteEntite, RequeteCommentaire,
    TypeRequete, PrioriteRequete,
)
from app.models.import_batch import ImportBatch, EntityTypeImport, StatutImport  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.revoked_token import RevokedToken  # noqa: F401
