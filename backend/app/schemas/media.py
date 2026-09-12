from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field

from app.models.media_asset import MediaType


class MediaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    media_type: MediaType
    url: AnyHttpUrl
    thumbnail_url: AnyHttpUrl | None = None
    alt_text: str | None = Field(default=None, max_length=500)
    caption: str | None = Field(default=None, max_length=5000)
    display_order: int = Field(default=0, ge=0)


class MediaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    media_type: MediaType | None = None
    url: AnyHttpUrl | None = None
    thumbnail_url: AnyHttpUrl | None = None
    alt_text: str | None = Field(default=None, max_length=500)
    caption: str | None = Field(default=None, max_length=5000)
    display_order: int | None = Field(default=None, ge=0)


class MediaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    media_type: MediaType
    url: str
    thumbnail_url: str | None
    alt_text: str | None
    caption: str | None
    display_order: int
    created_at: datetime
    updated_at: datetime


class MediaListResponse(BaseModel):
    items: list[MediaResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
