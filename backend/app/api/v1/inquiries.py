from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role, get_current_user
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.inquiry import (
    InquiryCreate,
    InquiryListResponse,
    InquiryResponse,
    InquiryUpdateStatus,
)
from app.services.inquiry import (
    create_inquiry,
    get_inquiry_for_user,
    list_client_inquiries,
    list_contractor_inquiries,
    update_inquiry_status,
)

router = APIRouter(prefix="/inquiries", tags=["inquiries"])
client_dependency = Depends(require_role(UserRole.CLIENT))
contractor_dependency = Depends(require_role(UserRole.CONTRACTOR))


def _list_response(
    inquiries: list[object],
    page: int,
    page_size: int,
    total: int,
    total_pages: int,
) -> InquiryListResponse:
    return InquiryListResponse(
        items=inquiries,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.post("", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
def create_client_inquiry(
    payload: InquiryCreate,
    current_user: User = client_dependency,
    db: Session = Depends(get_db),
) -> InquiryResponse:
    return create_inquiry(
        db,
        current_user,
        payload.contractor_id,
        payload.subject,
        payload.message,
    )


@router.get("/me", response_model=InquiryListResponse)
def list_my_inquiries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = client_dependency,
    db: Session = Depends(get_db),
) -> InquiryListResponse:
    inquiries, total, total_pages = list_client_inquiries(
        db, current_user, page, page_size
    )
    return _list_response(inquiries, page, page_size, total, total_pages)


@router.get("/received", response_model=InquiryListResponse)
def list_received_inquiries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> InquiryListResponse:
    inquiries, total, total_pages = list_contractor_inquiries(
        db, current_user, page, page_size
    )
    return _list_response(inquiries, page, page_size, total, total_pages)


@router.get("/{inquiry_id}", response_model=InquiryResponse)
def get_my_inquiry(
    inquiry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InquiryResponse:
    return get_inquiry_for_user(db, current_user, inquiry_id)


@router.patch("/{inquiry_id}/status", response_model=InquiryResponse)
def change_inquiry_status(
    inquiry_id: uuid.UUID,
    payload: InquiryUpdateStatus,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> InquiryResponse:
    return update_inquiry_status(
        db, current_user, inquiry_id, payload.status
    )
