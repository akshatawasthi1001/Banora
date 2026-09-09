"""Create generic media assets table.

Revision ID: 0005_create_media_assets
Revises: 0004_create_construction_journey
Create Date: 2026-09-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0005_create_media_assets"
down_revision: Union[str, Sequence[str], None] = "0004_create_construction_journey"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

media_type = postgresql.ENUM("IMAGE", "VIDEO", name="media_type")


def upgrade() -> None:
    bind = op.get_bind()
    media_type.create(bind, checkfirst=True)

    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("progress_update_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "media_type",
            postgresql.ENUM(
                "IMAGE", "VIDEO", name="media_type", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("thumbnail_url", sa.String(), nullable=True),
        sa.Column("alt_text", sa.String(), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
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
            "(project_id IS NOT NULL AND progress_update_id IS NULL) "
            "OR (project_id IS NULL AND progress_update_id IS NOT NULL)",
            name="ck_media_assets_exactly_one_owner",
        ),
        sa.CheckConstraint(
            "display_order >= 0",
            name="ck_media_assets_display_order_non_negative",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["progress_update_id"],
            ["progress_updates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_media_assets_project_id", "media_assets", ["project_id"])
    op.create_index(
        "ix_media_assets_progress_update_id",
        "media_assets",
        ["progress_update_id"],
    )
    op.create_index("ix_media_assets_media_type", "media_assets", ["media_type"])
    op.create_index("ix_media_assets_created_at", "media_assets", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_media_assets_created_at", table_name="media_assets")
    op.drop_index("ix_media_assets_media_type", table_name="media_assets")
    op.drop_index(
        "ix_media_assets_progress_update_id", table_name="media_assets"
    )
    op.drop_index("ix_media_assets_project_id", table_name="media_assets")
    op.drop_table("media_assets")
    media_type.drop(op.get_bind(), checkfirst=True)