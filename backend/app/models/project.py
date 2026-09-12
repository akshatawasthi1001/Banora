import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.contractor_profile import ContractorProfile
    from app.models.construction_stage import ConstructionStage
    from app.models.media_asset import MediaAsset


class ProjectType(str, enum.Enum):
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    RENOVATION = "RENOVATION"
    INTERIOR = "INTERIOR"
    OTHER = "OTHER"


class ProjectStatus(str, enum.Enum):
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(
            "plot_area_sqft IS NULL OR plot_area_sqft > 0",
            name="ck_projects_plot_area_positive",
        ),
        CheckConstraint(
            "built_up_area_sqft IS NULL OR built_up_area_sqft > 0",
            name="ck_projects_built_up_area_positive",
        ),
        CheckConstraint(
            "floors IS NULL OR floors > 0",
            name="ck_projects_floors_positive",
        ),
        CheckConstraint(
            "budget_min IS NULL OR budget_min >= 0",
            name="ck_projects_budget_min_non_negative",
        ),
        CheckConstraint(
            "budget_max IS NULL OR budget_max >= 0",
            name="ck_projects_budget_max_non_negative",
        ),
        CheckConstraint(
            "budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min",
            name="ck_projects_budget_range_valid",
        ),
        CheckConstraint(
            "start_date IS NULL OR completion_date IS NULL OR completion_date >= start_date",
            name="ck_projects_date_range_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    contractor_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contractor_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_type: Mapped[ProjectType] = mapped_column(
        Enum(ProjectType, name="project_type"), index=True, nullable=False
    )
    city: Mapped[str] = mapped_column(String, index=True, nullable=False)
    state: Mapped[str] = mapped_column(String, index=True, nullable=False)
    country: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(
        DOUBLE_PRECISION, nullable=True
    )
    longitude: Mapped[float | None] = mapped_column(
        DOUBLE_PRECISION, nullable=True
    )
    plot_area_sqft: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    built_up_area_sqft: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget_min: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completion_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status"),
        index=True,
        nullable=False,
        default=ProjectStatus.ONGOING,
        server_default="ONGOING",
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

    @property
    def contractor_id(self) -> uuid.UUID:
        return self.contractor_profile_id

    contractor_profile: Mapped["ContractorProfile"] = relationship(
        "ContractorProfile", back_populates="projects"
    )
    construction_stages: Mapped[list["ConstructionStage"]] = relationship(
        "ConstructionStage",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    media_assets: Mapped[list["MediaAsset"]] = relationship(
        "MediaAsset",
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )