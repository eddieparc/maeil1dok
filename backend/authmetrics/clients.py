"""Which client sent a request.

Two sources, in order:

1. The `X-Client` header, once the web app and shell start sending it. Explicit
   and unambiguous.
2. User-Agent, for the already-shipped 1.2.2 shell that will never send the
   header. This is a fallback, and a lossy one.

The UA fallback is deliberately conservative. iOS WebView, Android WebView, and
the shell's native `fetch` all have *different* signatures, so a classifier built
from one of them silently buckets the rest as `unknown` and skews every cohort
metric. Until the four real signatures are measured on device and recorded in
`docs/auth-migration-metrics.md`, `SHELL_UA_PATTERNS` stays empty and every
header-less request is honestly labelled `unknown` rather than guessed at.

`legacy-shell` is never merged into `unknown`: the whole point of the cohort is
to tell "old shell" apart from "some browser we don't recognise".
"""

from __future__ import annotations

import re

CLIENT_WEB = 'web'
CLIENT_SHELL = 'shell'
CLIENT_LEGACY_SHELL = 'legacy-shell'
CLIENT_UNKNOWN = 'unknown'

# Values the clients are allowed to declare via `X-Client`. Anything else is
# treated as absent, so a typo or a hostile value cannot invent a cohort.
DECLARED_CLIENTS = frozenset({CLIENT_WEB, CLIENT_SHELL})

# Measured User-Agent signatures of the shipped 1.2.2 shell.
#
# EMPTY BY DESIGN until the operator records the four real strings (iOS WebView /
# Android WebView / iOS native / Android native) in docs/auth-migration-metrics.md.
# Guessing here is worse than admitting ignorance: a partial pattern set produces
# confident-looking numbers that are wrong, and the baseline gets collected
# against them. See the `## 식별 문자열 실측(작업 2)` section of that document.
SHELL_UA_PATTERNS: tuple[re.Pattern[str], ...] = ()


def classify_client(*, declared: str | None, user_agent: str | None) -> str:
    """Return the client cohort for one request.

    A declared value wins when it is one we recognise. Otherwise fall back to
    User-Agent matching, and finally to `unknown`.
    """
    if declared:
        value = declared.strip().lower()
        if value in DECLARED_CLIENTS:
            return value

    ua = (user_agent or '').strip()
    if ua:
        for pattern in SHELL_UA_PATTERNS:
            if pattern.search(ua):
                return CLIENT_LEGACY_SHELL

    return CLIENT_UNKNOWN


def shell_patterns_are_configured() -> bool:
    """Whether the UA fallback can actually identify the legacy shell.

    The baseline collection gate reads this: collecting a 7-day baseline while
    every header-less request lands in `unknown` would fix the wrong numbers as
    the comparison point.
    """
    return bool(SHELL_UA_PATTERNS)
