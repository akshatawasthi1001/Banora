from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=5000)

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ReviewUpdate(ReviewCreate):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=5000)


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rating: int
    comment: str | None
    created_at: datetime
    updated_at: datetime


class ReviewListResponse(BaseModel):
    items: list[ReviewResponse]
    page: int
    page_size: int
    total: int
    total_pages: int


class ContractorRatingResponse(BaseModel):
    contractor_id: uuid.UUID
    average_rating: float
    review_count: int
    rating_distribution: dict[str, int]
