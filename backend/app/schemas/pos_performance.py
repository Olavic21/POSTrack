from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field

from app.models.pos_performance import SourcePerformance


class POSPerformanceCalculateRequest(BaseModel):
    period_start: date
    period_end: date


class POSPerformanceOut(BaseModel):
    id: int
    partner_id: int
    pos_id: int
    period_start: date
    period_end: date
    clients_count: int
    active_sims_count: int
    performance_score: Decimal | None
    source: SourcePerformance
    revenue: Decimal | None = 0
    stock_value: Decimal | None = 0
    created_at: datetime

    class Config:
        from_attributes = True


class DailyTrackingCreate(BaseModel):
    pos_id: int = Field(..., description="ID du POS concerné")
    tracking_date: date = Field(..., alias="date", description="Date du suivi (period_start = period_end = date)")
    revenue: float | None = Field(default=0, ge=0, description="Loading / montant vendu (FCFA)")
    stock_value: float | None = Field(default=0, ge=0, description="Sell-out / montant doté (FCFA)")
    active_sims_count: int | None = Field(default=0, ge=0)
    clients_count: int | None = Field(default=0, ge=0)

    model_config = {"populate_by_name": True}


class DailyTrackingUpdate(BaseModel):
    revenue: float | None = Field(default=None, ge=0)
    stock_value: float | None = Field(default=None, ge=0)
    active_sims_count: int | None = Field(default=None, ge=0)
    clients_count: int | None = Field(default=None, ge=0)
