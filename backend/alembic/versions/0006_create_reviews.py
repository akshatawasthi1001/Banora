"""Create contractor reviews table.

Revision ID: 0006_create_reviews
Revises: 0005_create_media_assets
Create Date: 2026-09-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0006_create_reviews"
down_revision: Union[str, Sequence[str], None] = "0005_create_media_assets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contractor_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
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
            "rating >= 1 AND rating <= 5",
            name="ck_reviews_rating_range",
        ),
        sa.ForeignKeyConstraint(["client_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["contractor_profile_id"],
            ["contractor_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "client_id",
            "contractor_profile_id",
            name="uq_reviews_client_contractor",
        ),
    )
    op.create_index("ix_reviews_client_id", "reviews", ["client_id"])
    op.create_index(
        "ix_reviews_contractor_profile_id",
        "reviews",
        ["contractor_profile_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_reviews_contractor_profile_id", table_name="reviews")
    op.drop_index("ix_reviews_client_id", table_name="reviews")
    op.drop_table("reviews")
