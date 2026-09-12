from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.project import ProjectStatus, ProjectType
from app.models.user import User, UserRole
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.project import (
    create_project,
    delete_owned_project,
    get_owned_project,
    get_project,
    list_owned_projects,
    list_public_projects,
    update_owned_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])
contractor_dependency = Depends(require_role(UserRole.CONTRACTOR))


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(
    payload: ProjectCreate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    return create_project(db, current_user, payload.model_dump())


@router.get("/me", response_model=ProjectListResponse)
def list_my_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    projects, total, total_pages = list_owned_projects(
        db, current_user, page, page_size
    )
    return ProjectListResponse(
        items=projects,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/me/{project_id}", response_model=ProjectResponse)
def get_my_project(
    project_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    return get_owned_project(db, current_user, project_id)


@router.patch("/me/{project_id}", response_model=ProjectResponse)
def update_my_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    return update_owned_project(
        db, current_user, project_id, payload.model_dump(exclude_unset=True)
    )


@router.delete("/me/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_project(
    project_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> Response:
    delete_owned_project(db, current_user, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=ProjectListResponse)
def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    city: str | None = None,
    state: str | None = None,
    project_type: ProjectType | None = None,
    status_filter: ProjectStatus | None = Query(default=None, alias="status"),
    contractor_id: uuid.UUID | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    projects, total, total_pages = list_public_projects(
        db,
        page=page,
        page_size=page_size,
        city=city,
        state=state,
        project_type=project_type,
        project_status=status_filter,
        contractor_id=contractor_id,
        search=search,
    )
    return ProjectListResponse(
        items=projects,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_public_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    return get_project(db, project_id)
