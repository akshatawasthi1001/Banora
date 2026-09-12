from __future__ import annotations

import math
import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.contractor_profile import ContractorProfile
from app.models.user import User


def create_profile(
    db: Session,
    user: User,
    profile_data: dict[str, object],
) -> ContractorProfile:
    existing_profile = (
        db.query(ContractorProfile)
        .filter(ContractorProfile.user_id == user.id)
        .one_or_none()
    )
    if existing_profile is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contractor profile already exists",
        )

    profile = ContractorProfile(user_id=user.id, **profile_data)
    db.add(profile)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contractor profile already exists",
        ) from exc
    db.refresh(profile)
    return profile


def get_profile_by_user_id(db: Session, user_id: uuid.UUID) -> ContractorProfile:
    profile = (
        db.query(ContractorProfile)
        .filter(ContractorProfile.user_id == user_id)
        .one_or_none()
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contractor profile not found",
        )
    return profile


def update_profile(
    db: Session,
    profile: ContractorProfile,
    profile_data: dict[str, object],
) -> ContractorProfile:
    for field_name, value in profile_data.items():
        setattr(profile, field_name, value)

    db.commit()
    db.refresh(profile)
    return profile


def list_profiles(
    db: Session,
    page: int,
    page_size: int,
    city: str | None = None,
    state: str | None = None,
    experience_years_min: int | None = None,
    search: str | None = None,
) -> tuple[list[ContractorProfile], int, int]:
    query = db.query(ContractorProfile)
    if city:
        query = query.filter(ContractorProfile.city.ilike(city))
    if state:
        query = query.filter(ContractorProfile.state.ilike(state))
    if experience_years_min is not None:
        query = query.filter(
            ContractorProfile.experience_years >= experience_years_min
        )
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                ContractorProfile.name.ilike(search_pattern),
                ContractorProfile.company_name.ilike(search_pattern),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total else 0
    profiles = (
        query.order_by(ContractorProfile.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return profiles, total, total_pages


def get_profile_by_id(db: Session, profile_id: uuid.UUID) -> ContractorProfile:
    profile = db.get(ContractorProfile, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contractor profile not found",
        )
    return profile
