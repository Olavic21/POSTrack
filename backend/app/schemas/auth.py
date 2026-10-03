from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr

from app.security.permissions import Role


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: str | None = None
    role: Role
    is_active: bool
    dsm_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str | None = None
    role: Role
    dsm_id: int | None = None
    partner_ids: list[int] = []
    pos_ids: list[int] = []


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    dsm_id: int | None = None
    is_active: bool | None = None


class PartnerAvailable(BaseModel):
    id: int
    code: str
    name: str
    contract_start_date: date | None = None

    model_config = ConfigDict(from_attributes=True)
