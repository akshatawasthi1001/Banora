from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ContractorProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    company_name: str | None = None
    bio: str | None = None
    profile_image_url: str | None = None
    phone: str | None = None
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    country: str = Field(min_length=1)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    experience_years: int = Field(default=0, ge=0)


class ContractorProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1)
    company_name: str | None = None
    bio: str | None = None
    profile_image_url: str | None = None
    phone: str | None = None
    city: str | None = Field(default=None, min_length=1)
    state: str | None = Field(default=None, min_length=1)
    country: str | None = Field(default=None, min_length=1)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    experience_years: int | None = Field(default=None, ge=0)


class ContractorProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    company_name: str | None
    bio: str | None
    profile_image_url: str | None
    phone: str | None
    city: str
    state: str
    country: str
    latitude: float | None
    longitude: float | None
    experience_years: int
    created_at: datetime
    updated_at: datetime


class ContractorProfileListResponse(BaseModel):
    items: list[ContractorProfileResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
