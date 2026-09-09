import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.progress_update import ProgressUpdate
    from app.models.project import Project


class ConstructionStageStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ConstructionStage(Base):
    __tablename__ = "construction_stages"
    __table_args__ = (
        CheckConstraint(
            "stage_order >= 1",
            name="ck_construction_stages_stage_order_positive",
        ),
        CheckConstraint(
            "started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at",
            name="ck_construction_stages_date_range_valid",
        ),
        UniqueConstraint(
            "project_id",
            "stage_order",
            name="uq_construction_stages_project_order",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    stage_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ConstructionStageStatus] = mapped_column(
        Enum(ConstructionStageStatus, name="construction_stage_status"),
        index=True,
        nullable=False,
        default=ConstructionStageStatus.NOT_STARTED,
        server_default="NOT_STARTED",
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    project: Mapped["Project"] = relationship(
        "Project", back_populates="construction_stages"
    )
    progress_updates: Mapped[list["ProgressUpdate"]] = relationship(
        "ProgressUpdate",
        back_populates="construction_stage",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )