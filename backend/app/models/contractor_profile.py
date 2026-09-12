import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.review import Review


class ContractorProfile(Base):
    __tablename__ = "contractor_profiles"
    __table_args__ = (
        CheckConstraint(
            "experience_years >= 0",
            name="ck_contractor_profiles_experience_years_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    company_name: Mapped[str | None] = mapped_column(String, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String, nullable=False)
    state: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(
        DOUBLE_PRECISION, nullable=True
    )
    longitude: Mapped[float | None] = mapped_column(
        DOUBLE_PRECISION, nullable=True
    )
    experience_years: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
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

    user: Mapped["User"] = relationship(
        "User", back_populates="contractor_profile"
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="contractor_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="contractor_profile",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )