from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.construction_stage import ConstructionStageStatus


class ConstructionStageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    stage_order: int = Field(ge=1)
    status: ConstructionStageStatus = ConstructionStageStatus.NOT_STARTED
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "ConstructionStageCreate":
        if (
            self.started_at is not None
            and self.completed_at is not None
            and self.completed_at < self.started_at
        ):
            raise ValueError("completed_at must be greater than or equal to started_at")
        return self


class ConstructionStageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    stage_order: int | None = Field(default=None, ge=1)
    status: ConstructionStageStatus | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ProgressUpdateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    progress_percentage: float = Field(ge=0, le=100)
    update_date: date


class ProgressUpdateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    progress_percentage: float | None = Field(default=None, ge=0, le=100)
    update_date: date | None = None


class ProgressUpdateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    progress_percentage: float
    update_date: date
    created_at: datetime
    updated_at: datetime


class ConstructionStageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    stage_order: int
    status: ConstructionStageStatus
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectJourneyStageResponse(ConstructionStageResponse):
    progress_updates: list[ProgressUpdateResponse] = Field(default_factory=list)


class ProjectJourneyResponse(BaseModel):
    project_id: uuid.UUID
    stages: list[ProjectJourneyStageResponse]
