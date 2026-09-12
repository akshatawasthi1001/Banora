"""Create client contractor inquiries table.

Revision ID: 0007_create_inquiries
Revises: 0006_create_reviews
Create Date: 2026-09-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0007_create_inquiries"
down_revision: Union[str, Sequence[str], None] = "0006_create_reviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

inquiry_status = postgresql.ENUM(
    "NEW",
    "CONTACTED",
    "CLOSED",
    name="inquiry_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    inquiry_status.create(bind, checkfirst=True)

    op.create_table(
        "inquiries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "contractor_profile_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "NEW",
                "CONTACTED",
                "CLOSED",
                name="inquiry_status",
                create_type=False,
            ),
            nullable=False,
            server_default="NEW",
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
        sa.ForeignKeyConstraint(["client_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["contractor_profile_id"],
            ["contractor_profiles.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inquiries_client_id", "inquiries", ["client_id"])
    op.create_index(
        "ix_inquiries_contractor_profile_id",
        "inquiries",
        ["contractor_profile_id"],
    )
    op.create_index("ix_inquiries_status", "inquiries", ["status"])
    op.create_index("ix_inquiries_created_at", "inquiries", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_inquiries_created_at", table_name="inquiries")
    op.drop_index("ix_inquiries_status", table_name="inquiries")
    op.drop_index(
        "ix_inquiries_contractor_profile_id",
        table_name="inquiries",
    )
    op.drop_index("ix_inquiries_client_id", table_name="inquiries")
    op.drop_table("inquiries")
    inquiry_status.drop(op.get_bind(), checkfirst=True)
