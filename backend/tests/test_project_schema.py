from sqlalchemy import inspect

from app.db.base import Base
from app.models import ContractorProfile, Project, ProjectStatus, ProjectType


def test_project_metadata() -> None:
    table = Base.metadata.tables["projects"]
    required_columns = {
        "id",
        "contractor_profile_id",
        "title",
        "description",
        "project_type",
        "city",
        "state",
        "country",
        "latitude",
        "longitude",
        "plot_area_sqft",
        "built_up_area_sqft",
        "floors",
        "budget_min",
        "budget_max",
        "start_date",
        "completion_date",
        "status",
        "created_at",
        "updated_at",
    }

    assert set(table.columns.keys()) == required_columns
    assert table.columns["contractor_profile_id"].index is True
    foreign_key = next(iter(table.columns["contractor_profile_id"].foreign_keys))
    assert str(foreign_key.target_fullname) == "contractor_profiles.id"
    assert [member.value for member in ProjectType] == [
        "RESIDENTIAL",
        "COMMERCIAL",
        "RENOVATION",
        "INTERIOR",
        "OTHER",
    ]
    assert [member.value for member in ProjectStatus] == ["ONGOING", "COMPLETED"]
    assert table.columns["status"].server_default.arg == "ONGOING"
    assert len(table.constraints) == 9
    assert all(
        column.type.__class__.__name__ != "FLOAT"
        for column in table.columns
        if column.name in {"plot_area_sqft", "built_up_area_sqft", "budget_min", "budget_max"}
    )


def test_contractor_profile_projects_relationship() -> None:
    assert inspect(ContractorProfile).relationships["projects"].uselist is True
    assert inspect(Project).relationships["contractor_profile"].uselist is False
    assert inspect(Project).relationships["contractor_profile"].back_populates == (
        "projects"
    )