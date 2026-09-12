from __future__ import annotations

import math
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.media_asset import MediaAsset, MediaType
from app.models.progress_update import ProgressUpdate
from app.models.project import Project
from app.models.user import User
from app.services.construction import (
    get_owned_progress_or_404,
    get_owned_project_or_404,
    get_progress_for_stage_or_404,
    get_project_or_404,
    get_stage_for_project_or_404,
)


def _normalize_media_data(media_data: dict[str, object]) -> dict[str, object]:
    normalized = dict(media_data)
    for field_name in ("url", "thumbnail_url"):
        if normalized.get(field_name) is not None:
            normalized[field_name] = str(normalized[field_name])
    return normalized


def _list_media(
    db: Session,
    query,
    page: int,
    page_size: int,
) -> tuple[list[MediaAsset], int, int]:
    total = query.count()
    total_pages = math.ceil(total / page_size) if total else 0
    media = (
        query.order_by(MediaAsset.display_order.asc(), MediaAsset.created_at.asc(), MediaAsset.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return media, total, total_pages


def _project_media_query(
    db: Session,
    project_id: uuid.UUID,
    media_type: MediaType | None = None,
):
    query = db.query(MediaAsset).filter(MediaAsset.project_id == project_id)
    if media_type is not None:
        query = query.filter(MediaAsset.media_type == media_type)
    return query


def create_project_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    media_data: dict[str, object],
) -> MediaAsset:
    get_owned_project_or_404(db, user, project_id)
    media = MediaAsset(
        project_id=project_id,
        **_normalize_media_data(media_data),
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


def list_project_media(
    db: Session,
    project_id: uuid.UUID,
    page: int,
    page_size: int,
    media_type: MediaType | None = None,
) -> tuple[list[MediaAsset], int, int]:
    get_project_or_404(db, project_id)
    return _list_media(
        db,
        _project_media_query(db, project_id, media_type),
        page,
        page_size,
    )


def list_owned_project_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    page: int,
    page_size: int,
    media_type: MediaType | None = None,
) -> tuple[list[MediaAsset], int, int]:
    get_owned_project_or_404(db, user, project_id)
    return _list_media(
        db,
        _project_media_query(db, project_id, media_type),
        page,
        page_size,
    )


def get_owned_project_media_or_404(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    media_id: uuid.UUID,
) -> MediaAsset:
    get_owned_project_or_404(db, user, project_id)
    media = (
        db.query(MediaAsset)
        .filter(
            MediaAsset.id == media_id,
            MediaAsset.project_id == project_id,
        )
        .one_or_none()
    )
    if media is None:
        raise HTTPException(status_code=404, detail="Media asset not found")
    return media


def update_project_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    media_id: uuid.UUID,
    media_data: dict[str, object],
) -> MediaAsset:
    media = get_owned_project_media_or_404(db, user, project_id, media_id)
    for field_name, value in _normalize_media_data(media_data).items():
        setattr(media, field_name, value)
    db.commit()
    db.refresh(media)
    return media


def delete_project_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    media_id: uuid.UUID,
) -> None:
    media = get_owned_project_media_or_404(db, user, project_id, media_id)
    db.delete(media)
    db.commit()


def get_owned_update_or_404(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> ProgressUpdate:
    return get_owned_progress_or_404(db, user, project_id, stage_id, update_id)


def get_public_update_or_404(
    db: Session,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> ProgressUpdate:
    get_project_or_404(db, project_id)
    get_stage_for_project_or_404(db, project_id, stage_id)
    update = get_progress_for_stage_or_404(db, stage_id, update_id)
    return update


def create_update_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    media_data: dict[str, object],
) -> MediaAsset:
    get_owned_update_or_404(db, user, project_id, stage_id, update_id)
    media = MediaAsset(
        progress_update_id=update_id,
        **_normalize_media_data(media_data),
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


def list_update_media(
    db: Session,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> list[MediaAsset]:
    get_public_update_or_404(db, project_id, stage_id, update_id)
    return (
        db.query(MediaAsset)
        .filter(MediaAsset.progress_update_id == update_id)
        .order_by(MediaAsset.display_order.asc(), MediaAsset.created_at.asc(), MediaAsset.id.asc())
        .all()
    )


def list_owned_update_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> list[MediaAsset]:
    get_owned_update_or_404(db, user, project_id, stage_id, update_id)
    return (
        db.query(MediaAsset)
        .filter(MediaAsset.progress_update_id == update_id)
        .order_by(MediaAsset.display_order.asc(), MediaAsset.created_at.asc(), MediaAsset.id.asc())
        .all()
    )


def get_owned_update_media_or_404(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    media_id: uuid.UUID,
) -> MediaAsset:
    get_owned_update_or_404(db, user, project_id, stage_id, update_id)
    media = (
        db.query(MediaAsset)
        .filter(
            MediaAsset.id == media_id,
            MediaAsset.progress_update_id == update_id,
        )
        .one_or_none()
    )
    if media is None:
        raise HTTPException(status_code=404, detail="Media asset not found")
    return media


def update_update_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    media_id: uuid.UUID,
    media_data: dict[str, object],
) -> MediaAsset:
    media = get_owned_update_media_or_404(
        db, user, project_id, stage_id, update_id, media_id
    )
    for field_name, value in _normalize_media_data(media_data).items():
        setattr(media, field_name, value)
    db.commit()
    db.refresh(media)
    return media


def delete_update_media(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    media_id: uuid.UUID,
) -> None:
    media = get_owned_update_media_or_404(
        db, user, project_id, stage_id, update_id, media_id
    )
    db.delete(media)
    db.commit()
