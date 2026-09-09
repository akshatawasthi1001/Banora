from sqlalchemy import inspect

from app.db.base import Base
from app.models import (
    ConstructionStage,
    ConstructionStageStatus,
    ProgressUpdate,
    Project,
)


def test_construction_stage_metadata() -> None:
    table = Base.metadata.tables["construction_stages"]

    assert table.columns["project_id"].index is True
    assert table.columns["stage_order"].nullable is False
    assert [member.value for member in ConstructionStageStatus] == [
        "NOT_STARTED",
        "IN_PROGRESS",
        "COMPLETED",
    ]
    assert table.columns["status"].server_default.arg == "NOT_STARTED"
    assert "uq_construction_stages_project_order" in {
        constraint.name for constraint in table.constraints
    }
    assert {
        "ck_construction_stages_stage_order_positive",
        "ck_construction_stages_date_range_valid",
    }.issubset({constraint.name for constraint in table.constraints})
    foreign_key = next(iter(table.columns["project_id"].foreign_keys))
    assert str(foreign_key.target_fullname) == "projects.id"


def test_progress_update_metadata() -> None:
    table = Base.metadata.tables["progress_updates"]

    assert table.columns["construction_stage_id"].index is True
    assert table.columns["progress_percentage"].nullable is False
    assert "ck_progress_updates_percentage_range" in {
        constraint.name for constraint in table.constraints
    }
    foreign_key = next(iter(table.columns["construction_stage_id"].foreign_keys))
    assert str(foreign_key.target_fullname) == "construction_stages.id"


def test_construction_journey_relationships() -> None:
    assert inspect(Project).relationships["construction_stages"].uselist is True
    assert inspect(ConstructionStage).relationships["project"].uselist is False
    assert inspect(ConstructionStage).relationships["progress_updates"].uselist is True
    assert inspect(ProgressUpdate).relationships["construction_stage"].uselist is False