from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.contractor import (
    ContractorProfileCreate,
    ContractorProfileListResponse,
    ContractorProfileResponse,
    ContractorProfileUpdate,
)
from app.services.contractor import (
    create_profile,
    get_profile_by_id,
    get_profile_by_user_id,
    list_profiles,
    update_profile,
)

router = APIRouter(prefix="/contractors", tags=["contractors"])
contractor_dependency = Depends(require_role(UserRole.CONTRACTOR))


@router.post(
    "/profile",
    response_model=ContractorProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_contractor_profile(
    payload: ContractorProfileCreate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ContractorProfileResponse:
    return create_profile(db, current_user, payload.model_dump())


@router.get("/me", response_model=ContractorProfileResponse)
def get_my_contractor_profile(
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ContractorProfileResponse:
    return get_profile_by_user_id(db, current_user.id)


@router.patch("/me", response_model=ContractorProfileResponse)
def update_my_contractor_profile(
    payload: ContractorProfileUpdate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ContractorProfileResponse:
    profile = get_profile_by_user_id(db, current_user.id)
    return update_profile(db, profile, payload.model_dump(exclude_unset=True))


@router.get("", response_model=ContractorProfileListResponse)
def list_contractor_profiles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    city: str | None = None,
    state: str | None = None,
    experience_years_min: int | None = Query(default=None, ge=0),
    search: str | None = None,
    db: Session = Depends(get_db),
) -> ContractorProfileListResponse:
    profiles, total, total_pages = list_profiles(
        db,
        page=page,
        page_size=page_size,
        city=city,
        state=state,
        experience_years_min=experience_years_min,
        search=search,
    )
    return ContractorProfileListResponse(
        items=profiles,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/{contractor_id}", response_model=ContractorProfileResponse)
def get_contractor_profile(
    contractor_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ContractorProfileResponse:
    return get_profile_by_id(db, contractor_id)
