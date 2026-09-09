from sqlalchemy import inspect

from app.db.base import Base
from app.models import ContractorProfile, User


def test_contractor_profile_metadata() -> None:
    table = Base.metadata.tables["contractor_profiles"]
    required_columns = {
        "id",
        "user_id",
        "name",
        "company_name",
        "bio",
        "profile_image_url",
        "phone",
        "city",
        "state",
        "country",
        "latitude",
        "longitude",
        "experience_years",
        "created_at",
        "updated_at",
    }

    assert set(table.columns.keys()) == required_columns
    assert table.columns["user_id"].unique is True
    assert table.columns["experience_years"].server_default is not None
    assert any(
        "experience_years >= 0" in str(constraint.sqltext)
        for constraint in table.constraints
        if hasattr(constraint, "sqltext")
    )
    foreign_keys = list(table.columns["user_id"].foreign_keys)
    assert len(foreign_keys) == 1
    assert str(foreign_keys[0].target_fullname) == "users.id"


def test_user_contractor_profile_relationship() -> None:
    assert inspect(User).relationships["contractor_profile"].uselist is False
    assert inspect(ContractorProfile).relationships["user"].back_populates == (
        "contractor_profile"
    )