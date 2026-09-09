"""Create projects table.

Revision ID: 0003_create_projects
Revises: 0002_create_contractor_profiles
Create Date: 2026-09-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0003_create_projects"
down_revision: Union[str, Sequence[str], None] = "0002_create_contractor_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

project_type = postgresql.ENUM(
    "RESIDENTIAL",
    "COMMERCIAL",
    "RENOVATION",
    "INTERIOR",
    "OTHER",
    name="project_type",
)
project_status = postgresql.ENUM(
    "ONGOING",
    "COMPLETED",
    name="project_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    project_type.create(bind, checkfirst=True)
    project_status.create(bind, checkfirst=True)

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contractor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "project_type",
            postgresql.ENUM(
                "RESIDENTIAL",
                "COMMERCIAL",
                "RENOVATION",
                "INTERIOR",
                "OTHER",
                name="project_type",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("country", sa.String(), nullable=False),
        sa.Column("latitude", postgresql.DOUBLE_PRECISION(), nullable=True),
        sa.Column("longitude", postgresql.DOUBLE_PRECISION(), nullable=True),
        sa.Column("plot_area_sqft", sa.Numeric(), nullable=True),
        sa.Column("built_up_area_sqft", sa.Numeric(), nullable=True),
        sa.Column("floors", sa.Integer(), nullable=True),
        sa.Column("budget_min", sa.Numeric(), nullable=True),
        sa.Column("budget_max", sa.Numeric(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("completion_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(
                "ONGOING",
                "COMPLETED",
                name="project_status",
                create_type=False,
            ),
            nullable=False,
            server_default="ONGOING",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "plot_area_sqft IS NULL OR plot_area_sqft > 0",
            name="ck_projects_plot_area_positive",
        ),
        sa.CheckConstraint(
            "built_up_area_sqft IS NULL OR built_up_area_sqft > 0",
            name="ck_projects_built_up_area_positive",
        ),
        sa.CheckConstraint(
            "floors IS NULL OR floors > 0",
            name="ck_projects_floors_positive",
        ),
        sa.CheckConstraint(
            "budget_min IS NULL OR budget_min >= 0",
            name="ck_projects_budget_min_non_negative",
        ),
        sa.CheckConstraint(
            "budget_max IS NULL OR budget_max >= 0",
            name="ck_projects_budget_max_non_negative",
        ),
        sa.CheckConstraint(
            "budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min",
            name="ck_projects_budget_range_valid",
        ),
        sa.CheckConstraint(
            "start_date IS NULL OR completion_date IS NULL OR completion_date >= start_date",
            name="ck_projects_date_range_valid",
        ),
        sa.ForeignKeyConstraint(
            ["contractor_profile_id"],
            ["contractor_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_projects_contractor_profile_id",
        "projects",
        ["contractor_profile_id"],
    )
    op.create_index("ix_projects_city", "projects", ["city"])
    op.create_index("ix_projects_state", "projects", ["state"])
    op.create_index("ix_projects_project_type", "projects", ["project_type"])
    op.create_index("ix_projects_status", "projects", ["status"])


def downgrade() -> None:
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_index("ix_projects_project_type", table_name="projects")
    op.drop_index("ix_projects_state", table_name="projects")
    op.drop_index("ix_projects_city", table_name="projects")
    op.drop_index("ix_projects_contractor_profile_id", table_name="projects")
    op.drop_table("projects")
    project_status.drop(op.get_bind(), checkfirst=True)
    project_type.drop(op.get_bind(), checkfirst=True)