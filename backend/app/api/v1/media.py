from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.media_asset import MediaType
from app.models.user import User, UserRole
from app.schemas.media import MediaCreate, MediaListResponse, MediaResponse, MediaUpdate
from app.services.media import (
    create_project_media,
    create_update_media,
    delete_project_media,
    delete_update_media,
    list_owned_project_media,
    list_owned_update_media,
    list_project_media,
    list_update_media,
    update_project_media,
    update_update_media,
)

router = APIRouter(prefix="/projects", tags=["media"])
contractor_dependency = Depends(require_role(UserRole.CONTRACTOR))


def _media_list_response(
    media: list[object],
    page: int,
    page_size: int,
    total: int,
    total_pages: int,
) -> MediaListResponse:
    return MediaListResponse(
        items=media,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/{project_id}/media", response_model=MediaListResponse)
def list_public_project_media(
    project_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    media_type: MediaType | None = None,
    db: Session = Depends(get_db),
) -> MediaListResponse:
    media, total, total_pages = list_project_media(
        db, project_id, page, page_size, media_type
    )
    return _media_list_response(media, page, page_size, total, total_pages)


@router.post(
    "/me/{project_id}/media",
    response_model=MediaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project_media_endpoint(
    project_id: uuid.UUID,
    payload: MediaCreate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> MediaResponse:
    return create_project_media(db, current_user, project_id, payload.model_dump())


@router.get("/me/{project_id}/media", response_model=MediaListResponse)
def list_owned_project_media_endpoint(
    project_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    media_type: MediaType | None = None,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> MediaListResponse:
    media, total, total_pages = list_owned_project_media(
        db, current_user, project_id, page, page_size, media_type
    )
    return _media_list_response(media, page, page_size, total, total_pages)


@router.patch(
    "/me/{project_id}/media/{media_id}",
    response_model=MediaResponse,
)
def update_project_media_endpoint(
    project_id: uuid.UUID,
    media_id: uuid.UUID,
    payload: MediaUpdate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> MediaResponse:
    return update_project_media(
        db,
        current_user,
        project_id,
        media_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete(
    "/me/{project_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_media_endpoint(
    project_id: uuid.UUID,
    media_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> Response:
    delete_project_media(db, current_user, project_id, media_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{project_id}/stages/{stage_id}/updates/{update_id}/media",
    response_model=list[MediaResponse],
)
def list_public_update_media(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[MediaResponse]:
    return list_update_media(db, project_id, stage_id, update_id)


@router.post(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}/media",
    response_model=MediaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_update_media_endpoint(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: MediaCreate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> MediaResponse:
    return create_update_media(
        db,
        current_user,
        project_id,
        stage_id,
        update_id,
        payload.model_dump(),
    )


@router.get(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}/media",
    response_model=list[MediaResponse],
)
def list_owned_update_media_endpoint(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> list[MediaResponse]:
    return list_owned_update_media(
        db, current_user, project_id, stage_id, update_id
    )


@router.patch(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}/media/{media_id}",
    response_model=MediaResponse,
)
def update_update_media_endpoint(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    media_id: uuid.UUID,
    payload: MediaUpdate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> MediaResponse:
    return update_update_media(
        db,
        current_user,
        project_id,
        stage_id,
        update_id,
        media_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_update_media_endpoint(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    media_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> Response:
    delete_update_media(
        db,
        current_user,
        project_id,
        stage_id,
        update_id,
        media_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
