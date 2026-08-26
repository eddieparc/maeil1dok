"""Emit one auth event per authenticated-surface request.

Why middleware rather than the authentication class: the event needs the response
status, and `authenticate()` runs before the view. Middleware sees both sides of
the call, so `status`, `outcome`, and `method` come from the same request without
threading state through the view layer.

Scope is deliberately narrow. Only requests whose path maps to a real auth route
bucket are recorded -- counting every `/api/v1/todos/...` call would bury the
signal and inflate the table for no gain.

The recording call cannot fail the request: `record_auth_event` swallows database
errors, and this middleware additionally guards against anything unexpected. A
metrics outage must never turn a login into a 5xx.
"""

from __future__ import annotations

import logging

from .clients import classify_client
from .models import AuthMethod, EventKind, Outcome, RouteBucket
from .recording import record_auth_event, route_bucket_for

logger = logging.getLogger(__name__)

# Attribute name the auth layer uses to publish how it authenticated. Set by
# `accounts.authentication.CookieJWTAuthentication`.
AUTH_METHOD_ATTR = 'auth_metrics_method'

# Buckets worth recording. `OTHER` is everything unrelated to auth.
_RECORDED_BUCKETS = frozenset(
    {
        RouteBucket.AUTH_USER,
        RouteBucket.AUTH_REFRESH,
        RouteBucket.AUTH_LOGIN,
        RouteBucket.AUTH_LOGOUT,
    }
)


class AuthEventLoggingMiddleware:
    """Record `auth` and `login` events for auth-surface requests."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._record(request, response)
        except Exception:  # noqa: BLE001 - metrics must never break a response
            logger.warning('auth event middleware failed', exc_info=True)
        return response

    @staticmethod
    def _record(request, response):
        bucket = route_bucket_for(request.path)
        if bucket not in _RECORDED_BUCKETS:
            return

        status = getattr(response, 'status_code', 0)
        client = classify_client(
            declared=request.headers.get('X-Client'),
            user_agent=request.headers.get('User-Agent'),
        )
        method = getattr(request, AUTH_METHOD_ATTR, None) or AuthMethod.NONE
        outcome = Outcome.SUCCESS if 200 <= status < 400 else Outcome.FAIL

        # A login attempt is its own event so success *rate* has a denominator.
        # Reusing the `auth` event would conflate "was already signed in" with
        # "tried to sign in", and §4 compares those two separately.
        event = (
            EventKind.LOGIN if bucket == RouteBucket.AUTH_LOGIN else EventKind.AUTH
        )

        record_auth_event(
            event=event,
            method=method,
            outcome=outcome,
            status=status,
            route=request.path,
            client=client,
        )
