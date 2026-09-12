from __future__ import annotations

import math
import uuid
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.contractor_profile import ContractorProfile
from app.models.project import Project, ProjectStatus, ProjectType
from app.models.user import User


def get_contractor_profile(db: Session, user: User) -> ContractorProfile:
    profile = (
        db.query(ContractorProfile)
        .filter(ContractorProfile.user_id == user.id)
        .one_or_none()
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contractor profile not found",
        )
    return profile


def _validate_ranges(
    budget_min: float | None,
    budget_max: float | None,
    start_date: date | None,
    completion_date: date | None,
) -> None:
    if budget_min is not None and budget_max is not None and budget_max < budget_min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="budget_max must be greater than or equal to budget_min",
        )
    if (
        start_date is not None
        and completion_date is not None
        and completion_date < start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="completion_date must be greater than or equal to start_date",
        )


def create_project(
    db: Session,
    user: User,
    project_data: dict[str, object],
) -> Project:
    profile = get_contractor_profile(db, user)
    _validate_ranges(
        project_data.get("budget_min"),
        project_data.get("budget_max"),
        project_data.get("start_date"),
        project_data.get("completion_date"),
    )
    project = Project(contractor_profile_id=profile.id, **project_data)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_owned_project(
    db: Session,
    user: User,
    project_id: uuid.UUID,
) -> Project:
    profile = get_contractor_profile(db, user)
    project = (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.contractor_profile_id == profile.id,
        )
        .one_or_none()
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def list_owned_projects(
    db: Session,
    user: User,
    page: int,
    page_size: int,
) -> tuple[list[Project], int, int]:
    profile = get_contractor_profile(db, user)
    query = db.query(Project).filter(Project.contractor_profile_id == profile.id)
    total = query.count()
    total_pages = math.ceil(total / page_size) if total else 0
    projects = (
        query.order_by(Project.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return projects, total, total_pages


def update_owned_project(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    project_data: dict[str, object],
) -> Project:
    project = get_owned_project(db, user, project_id)
    values = {
        "budget_min": project_data.get("budget_min", project.budget_min),
        "budget_max": project_data.get("budget_max", project.budget_max),
        "start_date": project_data.get("start_date", project.start_date),
        "completion_date": project_data.get(
            "completion_date", project.completion_date
        ),
    }
    _validate_ranges(**values)
    for field_name, value in project_data.items():
        setattr(project, field_name, value)
    db.commit()
    db.refresh(project)
    return project


def delete_owned_project(db: Session, user: User, project_id: uuid.UUID) -> None:
    project = get_owned_project(db, user, project_id)
    db.delete(project)
    db.commit()


def list_public_projects(
    db: Session,
    page: int,
    page_size: int,
    city: str | None = None,
    state: str | None = None,
    project_type: ProjectType | None = None,
    project_status: ProjectStatus | None = None,
    search: str | None = None,
) -> tuple[list[Project], int, int]:
    query = db.query(Project)
    if city:
        query = query.filter(Project.city.ilike(city))
    if state:
        query = query.filter(Project.state.ilike(state))
    if project_type is not None:
        query = query.filter(Project.project_type == project_type)
    if project_status is not None:
        query = query.filter(Project.status == project_status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Project.title.ilike(pattern),
                Project.description.ilike(pattern),
                Project.city.ilike(pattern),
                Project.state.ilike(pattern),
            )
        )
    total = query.count()
    total_pages = math.ceil(total / page_size) if total else 0
    projects = (
        query.order_by(Project.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return projects, total, total_pages


def get_project(db: Session, project_id: uuid.UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project
