"""Create construction stages and progress updates.

Revision ID: 0004_create_construction_journey
Revises: 0003_create_projects
Create Date: 2026-09-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0004_create_construction_journey"
down_revision: Union[str, Sequence[str], None] = "0003_create_projects"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

construction_stage_status = postgresql.ENUM(
    "NOT_STARTED",
    "IN_PROGRESS",
    "COMPLETED",
    name="construction_stage_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    construction_stage_status.create(bind, checkfirst=True)

    op.create_table(
        "construction_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("stage_order", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NOT_STARTED",
                "IN_PROGRESS",
                "COMPLETED",
                name="construction_stage_status",
                create_type=False,
            ),
            nullable=False,
            server_default="NOT_STARTED",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
            "stage_order >= 1",
            name="ck_construction_stages_stage_order_positive",
        ),
        sa.CheckConstraint(
            "started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at",
            name="ck_construction_stages_date_range_valid",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "stage_order", name="uq_construction_stages_project_order"),
    )
    op.create_index("ix_construction_stages_project_id", "construction_stages", ["project_id"])
    op.create_index("ix_construction_stages_status", "construction_stages", ["status"])

    op.create_table(
        "progress_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("construction_stage_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("progress_percentage", sa.Numeric(), nullable=False),
        sa.Column("update_date", sa.Date(), nullable=False),
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
            "progress_percentage >= 0 AND progress_percentage <= 100",
            name="ck_progress_updates_percentage_range",
        ),
        sa.ForeignKeyConstraint(
            ["construction_stage_id"],
            ["construction_stages.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_progress_updates_construction_stage_id",
        "progress_updates",
        ["construction_stage_id"],
    )
    op.create_index("ix_progress_updates_update_date", "progress_updates", ["update_date"])


def downgrade() -> None:
    op.drop_index("ix_progress_updates_update_date", table_name="progress_updates")
    op.drop_index(
        "ix_progress_updates_construction_stage_id", table_name="progress_updates"
    )
    op.drop_table("progress_updates")
    op.drop_index("ix_construction_stages_status", table_name="construction_stages")
    op.drop_index(
        "ix_construction_stages_project_id", table_name="construction_stages"
    )
    op.drop_table("construction_stages")
    construction_stage_status.drop(op.get_bind(), checkfirst=True)