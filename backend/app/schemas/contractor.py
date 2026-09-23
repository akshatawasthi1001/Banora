from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ContractorProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    company_name: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    profile_image_url: str | None = Field(default=None, max_length=2048)
    phone: str | None = Field(default=None, max_length=32)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    country: str = Field(min_length=1, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    experience_years: int = Field(default=0, ge=0)

    @field_validator("profile_image_url")
    @classmethod
    def validate_profile_image_url(cls, value: str | None) -> str | None:
        # Rendered directly as <img src>: restrict to http(s) URLs.
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("profile_image_url must be an http(s) URL")
        return value


class ContractorProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    company_name: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=5000)
    profile_image_url: str | None = Field(default=None, max_length=2048)
    phone: str | None = Field(default=None, max_length=32)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    state: str | None = Field(default=None, min_length=1, max_length=120)
    country: str | None = Field(default=None, min_length=1, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    experience_years: int | None = Field(default=None, ge=0)

    @field_validator("profile_image_url")
    @classmethod
    def validate_profile_image_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("http://", "https://")):
            raise ValueError("profile_image_url must be an http(s) URL")
        return value


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
