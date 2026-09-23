"""Minimal in-process rate limiter for authentication-sensitive endpoints.

Fixed-window counters keyed by (bucket, client IP). No external dependency;
state is per-process, which is acceptable for a single-container deployment
and provides meaningful abuse protection behind a single entrypoint.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import get_settings

_lock = threading.Lock()
_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    if request.client is None or not request.client.host:
        return "unknown"
    return request.client.host


def enforce_rate_limit(request: Request, bucket: str) -> None:
    """Raise 429 when the caller exceeds the configured attempt budget.

    Buckets are independent, so login and register each get their own window.
    """
    settings = get_settings()
    max_attempts = settings.auth_rate_limit_attempts
    window_seconds = settings.auth_rate_limit_window_seconds

    key = (bucket, _client_ip(request))
    now = time.monotonic()

    with _lock:
        window = _hits[key]
        while window and now - window[0] > window_seconds:
            window.popleft()
        if len(window) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
            )
        window.append(now)


def reset_rate_limits() -> None:
    """Clear all counters. Intended for tests, not for production use."""
    with _lock:
        _hits.clear()
