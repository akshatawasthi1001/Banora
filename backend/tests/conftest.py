"""Shared pytest fixtures for the Banora backend test suite."""

from __future__ import annotations

import pytest

from app.core.rate_limit import reset_rate_limits


@pytest.fixture(autouse=True)
def clean_rate_limiter() -> None:
    """Tests share one client IP; clear limiter state between tests."""
    reset_rate_limits()
