from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.construction_stage import ConstructionStage
from app.models.progress_update import ProgressUpdate
from app.models.project import Project
from app.models.user import User
from app.services.project import get_contractor_profile


def get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_owned_project_or_404(
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
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_stage_for_project_or_404(
    db: Session,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> ConstructionStage:
    stage = (
        db.query(ConstructionStage)
        .filter(
            ConstructionStage.id == stage_id,
            ConstructionStage.project_id == project_id,
        )
        .one_or_none()
    )
    if stage is None:
        raise HTTPException(status_code=404, detail="Construction stage not found")
    return stage


def get_owned_stage_or_404(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> ConstructionStage:
    get_owned_project_or_404(db, user, project_id)
    return get_stage_for_project_or_404(db, project_id, stage_id)


def validate_stage_dates(
    started_at: datetime | None,
    completed_at: datetime | None,
) -> None:
    if started_at is not None and started_at.tzinfo is not None:
        started_at = started_at.replace(tzinfo=None)
    if completed_at is not None and completed_at.tzinfo is not None:
        completed_at = completed_at.replace(tzinfo=None)
    if (
        started_at is not None
        and completed_at is not None
        and completed_at < started_at
    ):
        raise HTTPException(
            status_code=422,
            detail="completed_at must be greater than or equal to started_at",
        )


def list_public_stages(db: Session, project_id: uuid.UUID) -> list[ConstructionStage]:
    get_project_or_404(db, project_id)
    return (
        db.query(ConstructionStage)
        .filter(ConstructionStage.project_id == project_id)
        .order_by(ConstructionStage.stage_order.asc())
        .all()
    )


def create_stage(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_data: dict[str, object],
) -> ConstructionStage:
    get_owned_project_or_404(db, user, project_id)
    validate_stage_dates(stage_data.get("started_at"), stage_data.get("completed_at"))
    stage = ConstructionStage(project_id=project_id, **stage_data)
    db.add(stage)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stage order already exists for this project",
        ) from exc
    db.refresh(stage)
    return stage


def update_stage(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    stage_data: dict[str, object],
) -> ConstructionStage:
    stage = get_owned_stage_or_404(db, user, project_id, stage_id)
    validate_stage_dates(
        stage_data.get("started_at", stage.started_at),
        stage_data.get("completed_at", stage.completed_at),
    )
    for field_name, value in stage_data.items():
        setattr(stage, field_name, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stage order already exists for this project",
        ) from exc
    db.refresh(stage)
    return stage


def delete_stage(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> None:
    stage = get_owned_stage_or_404(db, user, project_id, stage_id)
    db.query(ProgressUpdate).filter(
        ProgressUpdate.construction_stage_id == stage.id
    ).delete(synchronize_session=False)
    db.delete(stage)
    db.commit()


def get_progress_for_stage_or_404(
    db: Session,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> ProgressUpdate:
    update = (
        db.query(ProgressUpdate)
        .filter(
            ProgressUpdate.id == update_id,
            ProgressUpdate.construction_stage_id == stage_id,
        )
        .one_or_none()
    )
    if update is None:
        raise HTTPException(status_code=404, detail="Progress update not found")
    return update


def get_owned_progress_or_404(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> ProgressUpdate:
    get_owned_stage_or_404(db, user, project_id, stage_id)
    return get_progress_for_stage_or_404(db, stage_id, update_id)


def list_public_updates(
    db: Session,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> list[ProgressUpdate]:
    get_project_or_404(db, project_id)
    get_stage_for_project_or_404(db, project_id, stage_id)
    return (
        db.query(ProgressUpdate)
        .filter(ProgressUpdate.construction_stage_id == stage_id)
        .order_by(
            ProgressUpdate.update_date.desc(),
            ProgressUpdate.created_at.desc(),
        )
        .all()
    )


def create_progress_update(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_data: dict[str, object],
) -> ProgressUpdate:
    get_owned_stage_or_404(db, user, project_id, stage_id)
    update = ProgressUpdate(construction_stage_id=stage_id, **update_data)
    db.add(update)
    db.commit()
    db.refresh(update)
    return update


def update_progress_update(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    update_data: dict[str, object],
) -> ProgressUpdate:
    update = get_owned_progress_or_404(
        db, user, project_id, stage_id, update_id
    )
    for field_name, value in update_data.items():
        setattr(update, field_name, value)
    db.commit()
    db.refresh(update)
    return update


def delete_progress_update(
    db: Session,
    user: User,
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
) -> None:
    update = get_owned_progress_or_404(
        db, user, project_id, stage_id, update_id
    )
    db.delete(update)
    db.commit()


def get_public_journey(db: Session, project_id: uuid.UUID) -> dict[str, object]:
    get_project_or_404(db, project_id)
    stages = (
        db.execute(
            select(ConstructionStage)
            .options(selectinload(ConstructionStage.progress_updates))
            .where(ConstructionStage.project_id == project_id)
            .order_by(ConstructionStage.stage_order.asc())
        )
        .scalars()
        .all()
    )
    for stage in stages:
        stage.progress_updates.sort(
            key=lambda update: (update.update_date, update.created_at),
            reverse=True,
        )
    return {"project_id": project_id, "stages": stages}
