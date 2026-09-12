from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.review import (
    ContractorRatingResponse,
    ReviewCreate,
    ReviewListResponse,
    ReviewResponse,
    ReviewUpdate,
)
from app.services.review import (
    create_review,
    delete_review,
    get_rating_summary,
    get_review,
    list_reviews,
    update_review,
)

router = APIRouter(prefix="/contractors", tags=["reviews"])
client_dependency = Depends(require_role(UserRole.CLIENT))


@router.post(
    "/{contractor_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contractor_review(
    contractor_id: uuid.UUID,
    payload: ReviewCreate,
    current_user: User = client_dependency,
    db: Session = Depends(get_db),
) -> ReviewResponse:
    return create_review(db, current_user, contractor_id, payload.model_dump())


@router.get("/{contractor_id}/reviews", response_model=ReviewListResponse)
def list_contractor_reviews(
    contractor_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ReviewListResponse:
    reviews, total, total_pages = list_reviews(db, contractor_id, page, page_size)
    return ReviewListResponse(
        items=reviews,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/{contractor_id}/reviews/{review_id}",
    response_model=ReviewResponse,
)
def get_contractor_review(
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ReviewResponse:
    return get_review(db, contractor_id, review_id)


@router.patch(
    "/{contractor_id}/reviews/{review_id}",
    response_model=ReviewResponse,
)
def update_contractor_review(
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
    payload: ReviewUpdate,
    current_user: User = client_dependency,
    db: Session = Depends(get_db),
) -> ReviewResponse:
    return update_review(
        db,
        current_user,
        contractor_id,
        review_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete(
    "/{contractor_id}/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_contractor_review(
    contractor_id: uuid.UUID,
    review_id: uuid.UUID,
    current_user: User = client_dependency,
    db: Session = Depends(get_db),
) -> Response:
    delete_review(db, current_user, contractor_id, review_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{contractor_id}/rating", response_model=ContractorRatingResponse)
def get_contractor_rating(
    contractor_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ContractorRatingResponse:
    return get_rating_summary(db, contractor_id)
