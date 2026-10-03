from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.import_batch import EntityTypeImport, StatutImport


class ImportBatchOut(BaseModel):
    id: int
    partner_id: int
    imported_by: int
    file_name: str
    entity_type: EntityTypeImport
    status: StatutImport
    total_rows: int
    valid_rows: int
    error_rows: int
    error_report_path: str | None
    valid_rows_path: str | None = None
    created_at: datetime
    applied_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ImportRowError(BaseModel):
    row: int
    field: str | None = None
    value: str | None = None
    reason: str


class ImportValidationResult(BaseModel):
    batch: ImportBatchOut
    preview: list[dict]
    errors: list[ImportRowError]
