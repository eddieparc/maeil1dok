"""Classify refresh failures and measure token age.

The north-star metric is `refresh_401{cause=blacklisted, refresh_age_seconds < 30d}`:
a refresh that was rejected as already-rotated *while still inside its lifetime*
is the fingerprint of the bug this migration exists to fix. Distinguishing that
from an ordinary expiry is the whole point, so `cause` has to be recorded per
rejection reason rather than as a single "refresh failed" counter.

Age comes from the token's own `iat`. When there is no trustworthy issue time the
age is `None` and the bucket becomes `unknown` -- never assumed young, because
that would put tokens of unknown age into the north-star numerator.
"""

from __future__ import annotations

import base64
import binascii
import json
import time
from typing import Any

# Rejection reasons, in the order the refresh view checks them.
CAUSE_MISSING_TOKEN = 'missing_token'
CAUSE_MALFORMED = 'malformed'
CAUSE_EXPIRED = 'expired'
CAUSE_BLACKLISTED = 'blacklisted'
CAUSE_MISSING_USER_CLAIM = 'missing_user_claim'
CAUSE_USER_NOT_FOUND = 'user_not_found'
CAUSE_USER_INACTIVE = 'user_inactive'
CAUSE_STALE_GENERATION = 'stale_generation'
CAUSE_CSRF = 'csrf'
CAUSE_OTHER = 'other'

ALL_CAUSES = frozenset(
    {
        CAUSE_MISSING_TOKEN,
        CAUSE_MALFORMED,
        CAUSE_EXPIRED,
        CAUSE_BLACKLISTED,
        CAUSE_MISSING_USER_CLAIM,
        CAUSE_USER_NOT_FOUND,
        CAUSE_USER_INACTIVE,
        CAUSE_STALE_GENERATION,
        CAUSE_CSRF,
        CAUSE_OTHER,
    }
)


def refresh_age_seconds(payload: Any) -> float | None:
    """Seconds since the token was issued, or None when unknowable.

    Returns None rather than 0 for a missing or unparseable `iat`: zero would read
    as a brand-new token and land in the `lt_30d` bucket, which is exactly the
    bucket the release gate watches.
    """
    if not isinstance(payload, dict):
        return None
    issued_at = payload.get('iat')
    if issued_at is None:
        return None
    try:
        issued = float(issued_at)
    except (TypeError, ValueError):
        return None
    age = time.time() - issued
    # A future `iat` means clock skew or a forged token; either way the age is
    # not trustworthy.
    return age if age >= 0 else None


def unverified_payload(raw_token: Any) -> dict | None:
    """Decode a JWT payload without verifying it, for bucketing only.

    Needed because `RefreshToken(raw)` raises *before* exposing a payload, and the
    blacklist/expiry branch is exactly where token age matters most: without `iat`
    the age bucket is `unknown`, and "rotated while still young" becomes
    indistinguishable from "simply expired" -- which is the entire north-star
    signal.

    This value is never used to authenticate, authorise, or identify anyone. It
    feeds one enum dimension on a counter row. A forged `iat` can only mislabel a
    metric the attacker's own failed request produced.
    """
    if not isinstance(raw_token, str):
        return None
    parts = raw_token.split('.')
    if len(parts) != 3:
        return None
    segment = parts[1]
    # JWT uses base64url without padding; restore it before decoding.
    padding = '=' * (-len(segment) % 4)
    try:
        decoded = base64.urlsafe_b64decode(segment + padding)
        payload = json.loads(decoded)
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def classify_token_error(error: Exception) -> str:
    """Map a SimpleJWT `TokenError` onto a cause.

    SimpleJWT reports blacklisting, expiry, and structural damage through the same
    exception type, distinguishable only by message. Message matching is fragile,
    so unrecognised text falls through to `other` instead of being guessed into a
    bucket a release gate reads.
    """
    message = str(error).lower()
    if 'blacklist' in message:
        return CAUSE_BLACKLISTED
    if 'expired' in message:
        return CAUSE_EXPIRED
    if any(token in message for token in ('not valid', 'invalid', 'decode', 'signature')):
        return CAUSE_MALFORMED
    return CAUSE_OTHER
