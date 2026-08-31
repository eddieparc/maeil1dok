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
    """Record that this user logged out. Returns the recorded instant.

    Advances the handoff generation as well as writing the timestamp. The timestamp
    rejects codes already published; the generation rejects codes still being
    published by an issue that started before this logout. Both are needed -- see
    the generation section below.
    """
    instant = now if now is not None else time.time()
    # Generation moves first. If the marker were written first, an issue that
    # already captured the old generation could publish in that gap with a later
    # timestamp and survive both invalidation checks.
    advance_generation(cache, user_id)
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


# --- Per-user handoff generation -------------------------------------------------
#
# The logout timestamp alone leaves one window open. The issue path stamps its
# instant when it COMMITS, so an issue that started before a logout and committed
# after it carries a later timestamp and passes the comparison -- a code minted
# from a pre-logout request stays redeemable after the user signed out.
#
# A monotonic per-user counter closes it. Issue reads the generation when it
# starts and publishes only if it is unchanged at commit; logout advances it. An
# issue straddling a logout is rejected at commit instead of silently winning.
#
# The counter shares the logout marker's lifetime: both describe "what happened to
# this user's session recently", and a counter that outlived the marker would keep
# rejecting issues for a logout no longer being enforced.


def generation_key(user_id) -> str:
    return f'session_bridge_gen:{user_id}'


def current_generation(cache, user_id) -> int:
    """The user's current handoff generation. Absent counter reads as 0."""
    value = cache.get(generation_key(user_id))
    try:
        return int(value) if value is not None else 0
    except (TypeError, ValueError):
        return 0


def advance_generation(cache, user_id) -> int:
    """Bump the generation, rejecting every issue that started before now.

    `cache.incr` is atomic on Redis, which is what makes concurrent logouts safe.
    It raises when the key is absent, so seed-then-retry covers the first logout.
    """
    key = generation_key(user_id)
    try:
        return int(cache.incr(key))
    except ValueError:
        # Key absent. `add` fails if another request seeded it first, in which case
        # incrementing is the correct move.
        if cache.add(key, 1, timeout=LOGOUT_MARKER_TTL_SECONDS):
            return 1
        return int(cache.incr(key))


def publish_code(cache, *, user_id, code, observed_generation, ttl_seconds) -> bool:
    """Publish a handoff code, unless a logout intervened since issue began.

    Returns False when the generation moved, meaning this issue straddled a logout
    and must not produce a usable code. The caller surfaces that as a retry rather
    than handing back a code that would be rejected at redemption anyway.

    The generation is re-read after writing, not only before: a logout landing
    between the check and the write would otherwise leave a live code behind. On a
    late detection the code is deleted again, so the window closes either way.
    """
    if current_generation(cache, user_id) != observed_generation:
        return False

    cache_key = f'session_bridge:{code}'
    cache.set(cache_key, build_code_payload(user_id), timeout=ttl_seconds)

    if current_generation(cache, user_id) != observed_generation:
        cache.delete(cache_key)
        return False

    return True
