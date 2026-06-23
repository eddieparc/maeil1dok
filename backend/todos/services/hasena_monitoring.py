from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Literal

logger = logging.getLogger(__name__)


def capture_hasena_summary_issue(
    message: str,
    *,
    level: Literal["warning", "error"] = "error",
    extra: Mapping[str, Any] | None = None,
    exception: BaseException | None = None,
) -> None:
    try:
        import sentry_sdk
    except ImportError:
        return

    try:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("feature", "hasena_summary")
            if extra:
                for key, value in extra.items():
                    scope.set_extra(key, value)

            if exception:
                sentry_sdk.capture_exception(exception)
            else:
                sentry_sdk.capture_message(message, level=level)
    except Exception:
        logger.debug("Failed to report Hasena summary issue to Sentry", exc_info=True)
