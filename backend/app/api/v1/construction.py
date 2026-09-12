from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.construction import (
    ConstructionStageCreate,
    ConstructionStageResponse,
    ConstructionStageUpdate,
    ProgressUpdateCreate,
    ProgressUpdateResponse,
    ProgressUpdateUpdate,
    ProjectJourneyResponse,
)
from app.services.construction import (
    create_progress_update,
    create_stage,
    delete_progress_update,
    delete_stage,
    get_owned_progress_or_404,
    get_owned_stage_or_404,
    get_public_journey,
    get_stage_for_project_or_404,
    list_public_stages,
    list_public_updates,
    update_progress_update,
    update_stage,
)

router = APIRouter(prefix="/projects", tags=["construction"])
contractor_dependency = Depends(require_role(UserRole.CONTRACTOR))


@router.get("/{project_id}/stages", response_model=list[ConstructionStageResponse])
def list_stages(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[ConstructionStageResponse]:
    return list_public_stages(db, project_id)


@router.post(
    "/me/{project_id}/stages",
    response_model=ConstructionStageResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project_stage(
    project_id: uuid.UUID,
    payload: ConstructionStageCreate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ConstructionStageResponse:
    return create_stage(db, current_user, project_id, payload.model_dump())


@router.get(
    "/me/{project_id}/stages/{stage_id}",
    response_model=ConstructionStageResponse,
)
def get_project_stage(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ConstructionStageResponse:
    return get_owned_stage_or_404(db, current_user, project_id, stage_id)


@router.patch(
    "/me/{project_id}/stages/{stage_id}",
    response_model=ConstructionStageResponse,
)
def update_project_stage(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    payload: ConstructionStageUpdate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ConstructionStageResponse:
    return update_stage(
        db,
        current_user,
        project_id,
        stage_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete(
    "/me/{project_id}/stages/{stage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_stage(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> Response:
    delete_stage(db, current_user, project_id, stage_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{project_id}/stages/{stage_id}/updates",
    response_model=list[ProgressUpdateResponse],
)
def list_stage_updates(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[ProgressUpdateResponse]:
    return list_public_updates(db, project_id, stage_id)


@router.post(
    "/me/{project_id}/stages/{stage_id}/updates",
    response_model=ProgressUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_stage_update(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    payload: ProgressUpdateCreate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProgressUpdateResponse:
    return create_progress_update(
        db, current_user, project_id, stage_id, payload.model_dump()
    )


@router.get(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}",
    response_model=ProgressUpdateResponse,
)
def get_stage_update(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProgressUpdateResponse:
    return get_owned_progress_or_404(
        db, current_user, project_id, stage_id, update_id
    )


@router.patch(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}",
    response_model=ProgressUpdateResponse,
)
def update_stage_update(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: ProgressUpdateUpdate,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> ProgressUpdateResponse:
    return update_progress_update(
        db,
        current_user,
        project_id,
        stage_id,
        update_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete(
    "/me/{project_id}/stages/{stage_id}/updates/{update_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_stage_update(
    project_id: uuid.UUID,
    stage_id: uuid.UUID,
    update_id: uuid.UUID,
    current_user: User = contractor_dependency,
    db: Session = Depends(get_db),
) -> Response:
    delete_progress_update(db, current_user, project_id, stage_id, update_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/journey", response_model=ProjectJourneyResponse)
def get_project_journey(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ProjectJourneyResponse:
    return get_public_journey(db, project_id)
