from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.inquiry import InquiryStatus


class InquiryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contractor_id: uuid.UUID
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=10000)

    @field_validator("subject", "message")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must not be blank")
        return normalized


class InquiryUpdateStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: InquiryStatus


class InquiryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    contractor_profile_id: uuid.UUID
    subject: str
    message: str
    status: InquiryStatus
    created_at: datetime
    updated_at: datetime


class InquiryListResponse(BaseModel):
    items: list[InquiryResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
