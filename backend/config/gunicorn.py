from __future__ import annotations

import os


accesslog = None
errorlog = "-"
capture_output = True

logconfig_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "config.logging_config.JsonFormatter",
            "service": "backend",
            "environment": os.environ.get("SENTRY_ENVIRONMENT", "production"),
        },
    },
    "handlers": {
        "error_console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "stream": "ext://sys.stderr",
        },
    },
    "root": {
        "handlers": ["error_console"],
        "level": "INFO",
    },
    "loggers": {
        "gunicorn.error": {
            "handlers": ["error_console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
