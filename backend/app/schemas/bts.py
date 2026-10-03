from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BTSCreate(BaseModel):
    code_bts: str
    operateur: str | None = None
    technologie: str | None = None
    capacite_max: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    zone: str | None = None


class BTSOut(BaseModel):
    id: int
    partner_id: int
    code_bts: str
    operateur: str | None
    technologie: str | None
    capacite_max: float | None
    latitude: float | None
    longitude: float | None
    zone: str | None
    created_at: datetime
    # Champs d'affichage calcules par la couche service :
    ville: str | None = None                 # alias metier de zone
    derniere_saturation: float | None = None  # taux de saturation du dernier releve
    quartier: str | None = None              # alias metier de zone (quartier)
    micro_zone: str | None = None            # micro-zone geographique pour ce BTS
    region: str | None = None               # region / zone geographique pour la carte
    statut: str | None = None               # statut actuel du BTS (actif/maintenance/hors_service)
    saturation: float | None = None         # taux de saturation actuel du dernier relev

    model_config = ConfigDict(from_attributes=True)


class BTSReleveCreate(BaseModel):
    charge: float | None = None
    taux_saturation: float | None = None
    rendement: float | None = None
    commentaire: str | None = None


class BTSReleveListOut(BaseModel):
    id: int
    bts_id: int
    bts_nom: str
    code: str
    charge: float | None = None
    debit: float | None = None
    connexions: int | None = None
    latence: float | None = None
    statut: str = "actif"
    date_releve: datetime
    rendement: float | None = None


class BTSReleveOut(BaseModel):
    id: int
    bts_id: int
    date_releve: datetime
    charge: float | None
    taux_saturation: float | None
    rendement: float | None
    commentaire: str | None

    model_config = ConfigDict(from_attributes=True)
