from sqlalchemy import inspect

from app.db.base import Base
from app.models import MediaAsset, MediaType, ProgressUpdate, Project


def test_media_asset_metadata() -> None:
    table = Base.metadata.tables["media_assets"]

    assert table.columns["project_id"].index is True
    assert table.columns["progress_update_id"].index is True
    assert table.columns["media_type"].nullable is False
    assert table.columns["url"].nullable is False
    assert table.columns["display_order"].server_default.arg == "0"
    assert [member.value for member in MediaType] == ["IMAGE", "VIDEO"]
    assert {
        "ck_media_assets_exactly_one_owner",
        "ck_media_assets_display_order_non_negative",
    }.issubset({constraint.name for constraint in table.constraints})

    project_foreign_key = next(iter(table.columns["project_id"].foreign_keys))
    progress_foreign_key = next(
        iter(table.columns["progress_update_id"].foreign_keys)
    )
    assert str(project_foreign_key.target_fullname) == "projects.id"
    assert str(progress_foreign_key.target_fullname) == "progress_updates.id"


def test_media_asset_relationships() -> None:
    assert inspect(Project).relationships["media_assets"].uselist is True
    assert inspect(ProgressUpdate).relationships["media_assets"].uselist is True
    assert inspect(MediaAsset).relationships["project"].uselist is False
    assert inspect(MediaAsset).relationships["progress_update"].uselist is False
    assert inspect(MediaAsset).relationships["project"].back_populates == (
        "media_assets"
    )
    assert inspect(MediaAsset).relationships["progress_update"].back_populates == (
        "media_assets"
    )