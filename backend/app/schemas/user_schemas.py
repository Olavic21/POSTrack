from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.security.permissions import Role


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: str | None = None
    role: Role
    is_active: bool
    dsm_id: int | None = None
    partner_id: int | None = None
    partner_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str | None = None
    role: Role
    dsm_id: int | None = None
    partner_id: int | None = None
    partner_ids: list[int] = []
    pos_ids: list[int] = []


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    full_name: str | None = None
    role: Role | None = None
    dsm_id: int | None = None
    partner_id: int | None = None
    is_active: bool | None = None