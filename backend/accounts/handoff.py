"""Handoff-code invalidation on logout.

A session-bridge code is a one-shot credential that turns into WebView auth
cookies. Logout must invalidate the ones already issued but not yet redeemed,
otherwise a code that arrives a moment later revives the session the user just
ended -- the app would appear signed in again right after signing out.

Codes are keyed by the code itself (`session_bridge:<uuid>`), with no per-user
index, so "delete this user's outstanding codes" is not directly expressible.
Two ways to close that gap:

1. Maintain a per-user list of outstanding codes and delete them on logout.
   A code issued concurrently with the logout is absent from the list the logout
   read, so it survives -- and stays valid for the rest of its TTL.
2. Record a per-user logout instant and stamp each code with its issue instant;
   redemption compares the two. No enumeration, and no race: every code issued
   before the logout is rejected, including ones issued while the logout was
   still running.

This module implements (2). The marker's TTL is deliberately much longer than a
code's TTL, so a marker cannot be evicted while a code it should reject is still
alive.

Backward compatibility matters here. Codes already in the cache hold a bare
`user_id` int; new codes hold a dict. Redemption reads both shapes, because
rejecting the old one would break every handoff in flight at the moment of
deploy.
"""

from __future__ import annotations

import time

# Marker lifetime. Must exceed the code TTL by a wide margin: if the marker were
# evicted first, codes issued before the logout would become acceptable again.
LOGOUT_MARKER_TTL_SECONDS = 24 * 60 * 60


def logout_marker_key(user_id) -> str:
    return f'auth_logout_at:{user_id}'


def mark_logged_out(cache, user_id, *, now=None) -> float:
    """Record that this user logged out. Returns the recorded instant."""
    instant = now if now is not None else time.time()
    cache.set(logout_marker_key(user_id), instant, timeout=LOGOUT_MARKER_TTL_SECONDS)
    return instant


def logged_out_at(cache, user_id):
    """The user's last recorded logout instant, or None."""
    value = cache.get(logout_marker_key(user_id))
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def build_code_payload(user_id, *, now=None) -> dict:
    """The value stored under a freshly issued handoff code."""
    return {
        'user_id': user_id,
        'issued_at': now if now is not None else time.time(),
    }


def read_code_payload(value):
    """Normalise a stored code value into `(user_id, issued_at)`.

    Accepts the legacy bare-int shape so handoffs already in flight keep working
    across the deploy. A legacy code has no issue time; `issued_at` is None and
    the caller decides what that means.
    """
    if isinstance(value, dict):
        user_id = value.get('user_id')
        if user_id is None:
            return None, None
        issued_at = value.get('issued_at')
        try:
            issued_at = float(issued_at) if issued_at is not None else None
        except (TypeError, ValueError):
            issued_at = None
        return user_id, issued_at
    if isinstance(value, bool):
        # `bool` is an `int` subclass; a boolean here is corrupt data, not a user id.
        return None, None
    if isinstance(value, int):
        return value, None
    return None, None


def code_is_invalidated_by_logout(cache, user_id, issued_at) -> bool:
    """Whether a logout supersedes this code.

    A legacy code (`issued_at is None`) is rejected whenever a logout marker
    exists at all. That is the conservative reading: the code cannot prove it was
    issued after the logout, and reviving a session the user ended is worse than
    making them tap sign-in once. The window is bounded by the code's 60s TTL.
    """
    marker = logged_out_at(cache, user_id)
    if marker is None:
        return False
    if issued_at is None:
        return True
    return issued_at <= marker
