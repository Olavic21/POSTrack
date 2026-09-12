from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

from app.models.pos import TypePos, StatutPos, LinkageStatus


class POSPartnerNested(BaseModel):
    """Partenaire minimal imbrique dans une ligne POS (nom affichable)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class POSDsmNested(BaseModel):
    """DSM minimal imbrique dans une ligne POS."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


class POSCreate(BaseModel):
    code_pos: str
    name: str
    address: str | None = None
    zone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    dsm_id: int
    holder_user_id: int | None = None
    date_creation: date
    date_expiration: date
    stock_initial: int = 0
    stock_actuel: int | None = None


class POSUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    zone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    holder_user_id: int | None = None
    status: StatutPos | None = None
    stock_actuel: int | None = None


class POSOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code_pos: str
    name: str
    address: str | None
    zone: str | None
    latitude: float | None
    longitude: float | None
    partner_id: int
    dsm_id: int
    holder_user_id: int | None
    type_pos: TypePos
    status: StatutPos
    stock_initial: int
    stock_actuel: int
    # Stocks différenciés (conceptuel, sans migration destructive – calculé)
    stock_initial_creation: int | None = None
    stock_initial_reconduction: int | None = None
    stock_final_creation: int | None = None
    stock_final_reconduction: int | None = None
    donnees_additionnelles: dict | None = None
    date_creation: date
    # Alias métier : Date de prise en portefeuille
    date_prise_en_portefeuille: date | None = None
    date_expiration: date
    date_derniere_reconduction: date | None
    created_at: datetime
    # Objets imbriques pour l'affichage (colonnes Partenaire / DSM des tableaux)
    partner: POSPartnerNested | None = None
    dsm: POSDsmNested | None = None
    # Statut de linkage déduit
    linkage_status: LinkageStatus


class POSOutEnriched(POSOut):
    """POS enrichi avec les données métier calculées (loading, sell-out, recettes)."""
    loading: int = 0
    sell_out: int = 0
    recettes: float = 0


class ReconductionCreate(BaseModel):
    new_expiration: date
    motif: str | None = None


class ReconductionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pos_id: int
    old_expiration: date
    new_expiration: date
    motif: str | None
    author_id: int
    created_at: datetime


class POSLinkCreate(BaseModel):
    user_id: int


class POSUnlinkCreate(BaseModel):
    user_id: int | None = None


class POSLinkOut(BaseModel):
    pos_id: int
    holder_user_id: int | None
    linked_users: list[int]