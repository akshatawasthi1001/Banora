from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.project import ProjectStatus, ProjectType


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: str | None = None
    project_type: ProjectType
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    country: str = Field(min_length=1)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    plot_area_sqft: float | None = Field(default=None, gt=0)
    built_up_area_sqft: float | None = Field(default=None, gt=0)
    floors: int | None = Field(default=None, gt=0)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    start_date: date | None = None
    completion_date: date | None = None
    status: ProjectStatus = ProjectStatus.ONGOING

    @model_validator(mode="after")
    def validate_ranges(self) -> "ProjectCreate":
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_max < self.budget_min
        ):
            raise ValueError("budget_max must be greater than or equal to budget_min")
        if (
            self.start_date is not None
            and self.completion_date is not None
            and self.completion_date < self.start_date
        ):
            raise ValueError("completion_date must be greater than or equal to start_date")
        return self


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    project_type: ProjectType | None = None
    city: str | None = Field(default=None, min_length=1)
    state: str | None = Field(default=None, min_length=1)
    country: str | None = Field(default=None, min_length=1)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    plot_area_sqft: float | None = Field(default=None, gt=0)
    built_up_area_sqft: float | None = Field(default=None, gt=0)
    floors: int | None = Field(default=None, gt=0)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    start_date: date | None = None
    completion_date: date | None = None
    status: ProjectStatus | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    project_type: ProjectType
    city: str
    state: str
    country: str
    latitude: float | None
    longitude: float | None
    plot_area_sqft: float | None
    built_up_area_sqft: float | None
    floors: int | None
    budget_min: float | None
    budget_max: float | None
    start_date: date | None
    completion_date: date | None
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
