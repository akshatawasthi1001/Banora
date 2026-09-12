from __future__ import annotations

import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.contractor_profile import ContractorProfile
from app.models.inquiry import Inquiry, InquiryStatus
from app.models.user import User, UserRole


def get_contractor_or_404(
    db: Session,
    contractor_id: uuid.UUID,
) -> ContractorProfile:
    contractor = db.get(ContractorProfile, contractor_id)
    if contractor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contractor profile not found",
        )
    return contractor


def _paginate_inquiries(
    query,
    page: int,
    page_size: int,
) -> tuple[list[Inquiry], int, int]:
    total = query.count()
    total_pages = math.ceil(total / page_size) if total else 0
    inquiries = (
        query.order_by(Inquiry.created_at.desc(), Inquiry.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return inquiries, total, total_pages


def create_inquiry(
    db: Session,
    client: User,
    contractor_id: uuid.UUID,
    subject: str,
    message: str,
) -> Inquiry:
    contractor = get_contractor_or_404(db, contractor_id)
    if contractor.user_id == client.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot send an inquiry to yourself",
        )
    if client.role != UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can create inquiries",
        )

    inquiry = Inquiry(
        client_id=client.id,
        contractor_profile_id=contractor.id,
        subject=subject,
        message=message,
        status=InquiryStatus.NEW,
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    return inquiry


def list_client_inquiries(
    db: Session,
    client: User,
    page: int,
    page_size: int,
) -> tuple[list[Inquiry], int, int]:
    query = db.query(Inquiry).filter(Inquiry.client_id == client.id)
    return _paginate_inquiries(query, page, page_size)


def list_contractor_inquiries(
    db: Session,
    contractor: User,
    page: int,
    page_size: int,
) -> tuple[list[Inquiry], int, int]:
    profile = contractor.contractor_profile
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contractor profile not found",
        )
    query = db.query(Inquiry).filter(
        Inquiry.contractor_profile_id == profile.id
    )
    return _paginate_inquiries(query, page, page_size)


def get_inquiry_for_user(
    db: Session,
    user: User,
    inquiry_id: uuid.UUID,
) -> Inquiry:
    inquiry = db.get(Inquiry, inquiry_id)
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquiry not found",
        )

    is_client_owner = (
        user.role == UserRole.CLIENT and inquiry.client_id == user.id
    )
    is_contractor_recipient = (
        user.role == UserRole.CONTRACTOR
        and user.contractor_profile is not None
        and inquiry.contractor_profile_id == user.contractor_profile.id
    )
    if not is_client_owner and not is_contractor_recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquiry not found",
        )
    return inquiry


def update_inquiry_status(
    db: Session,
    contractor: User,
    inquiry_id: uuid.UUID,
    next_status: InquiryStatus,
) -> Inquiry:
    inquiry = get_inquiry_for_user(db, contractor, inquiry_id)
    if contractor.role != UserRole.CONTRACTOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the receiving contractor can update inquiry status",
        )

    allowed_next_statuses = {
        InquiryStatus.NEW: InquiryStatus.CONTACTED,
        InquiryStatus.CONTACTED: InquiryStatus.CLOSED,
    }
    expected_next_status = allowed_next_statuses.get(inquiry.status)
    if expected_next_status != next_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invalid inquiry status transition",
        )

    inquiry.status = next_status
    db.commit()
    db.refresh(inquiry)
    return inquiry
