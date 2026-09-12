from __future__ import annotations

import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.contractor_profile import ContractorProfile
from app.models.review import Review
from app.models.user import User, UserRole


def get_contractor_or_404(db: Session, contractor_id: uuid.UUID) -> ContractorProfile:
    contractor = db.get(ContractorProfile, contractor_id)
    if contractor is None:
        raise HTTPException(status_code=404, detail="Contractor profile not found")
    return contractor


def create_review(
    db: Session,
    client: User,
    contractor_id: uuid.UUID,
    review_data: dict[str, object],
) -> Review:
    contractor = get_contractor_or_404(db, contractor_id)
    if contractor.user_id == client.id or client.role != UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients cannot review themselves",
        )

    existing = (
        db.query(Review)
        .filter(
            Review.client_id == client.id,
            Review.contractor_profile_id == contractor.id,
        )
        .one_or_none()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Review already exists",
        )

    review = Review(
        client_id=client.id,
        contractor_profile_id=contractor.id,
        **review_data,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Review already exists",
        ) from exc
    db.refresh(review)
    return review


def list_reviews(
    db: Session,
    contractor_id: uuid.UUID,
    page: int,
    page_size: int,
) -> tuple[list[Review], int, int]:
    get_contractor_or_404(db, contractor_id)
    query = (
        db.query(Review)
        .filter(Review.contractor_profile_id == contractor_id)
        .order_by(Review.created_at.desc())
    )
    total = query.count()
    total_pages = math.ceil(total / page_size) if total else 0
    reviews = query.offset((page - 1) * page_size).limit(page_size).all()
    return reviews, total, total_pages


def get_review(
    db: Session,
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
) -> Review:
    get_contractor_or_404(db, contractor_id)
    review = (
        db.query(Review)
        .filter(
            Review.id == review_id,
            Review.contractor_profile_id == contractor_id,
        )
        .one_or_none()
    )
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


def get_owned_review(
    db: Session,
    client: User,
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
) -> Review:
    review = get_review(db, contractor_id, review_id)
    if review.client_id != client.id:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


def update_review(
    db: Session,
    client: User,
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
    review_data: dict[str, object],
) -> Review:
    review = get_owned_review(db, client, contractor_id, review_id)
    for field_name, value in review_data.items():
        setattr(review, field_name, value)
    db.commit()
    db.refresh(review)
    return review


def delete_review(
    db: Session,
    client: User,
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
) -> None:
    review = get_owned_review(db, client, contractor_id, review_id)
    db.delete(review)
    db.commit()


def get_rating_summary(
    db: Session,
    contractor_id: uuid.UUID,
) -> dict[str, object]:
    get_contractor_or_404(db, contractor_id)
    summary = (
        db.query(
            func.count(Review.id),
            func.avg(Review.rating),
            *[
                func.sum(case((Review.rating == rating, 1), else_=0))
                for rating in range(1, 6)
            ],
        )
        .filter(Review.contractor_profile_id == contractor_id)
        .one()
    )
    review_count = int(summary[0] or 0)
    average_rating = round(float(summary[1] or 0), 2)
    distribution = {
        str(rating): int(summary[rating + 1] or 0)
        for rating in range(1, 6)
    }
    return {
        "contractor_id": contractor_id,
        "average_rating": average_rating,
        "review_count": review_count,
        "rating_distribution": distribution,
    }
