"""Explicitly excluded HTTP routes for the API characterization suite.

Keys are URLconf route patterns, not route names. This prevents a newly added route
that reuses an existing name from being silently excluded.
"""

EXCLUDED_ROUTES = {
    "ready/": (
        "The operational readiness payload intentionally changes with scheduler "
        "windows and cache heartbeat state."
    ),
    "api/v1/auth/social-login/": "Calls the Kakao OAuth provider.",
    "api/v1/auth/complete-kakao-signup/": "Validates credentials with the Kakao OAuth provider.",
    "api/v1/auth/social-login/v2/": "Calls Kakao, Google, or Apple OAuth providers.",
    "api/v1/auth/complete-social-signup/": "May validate credentials with an external OAuth provider.",
    "api/v1/auth/link-social/": "Links an account after calling an external OAuth provider.",
    "api/v1/auth/merge-accounts/": "The social-account merge flow calls an external OAuth provider.",
    "api/v1/auth/send-verification/": "Sends email through the production email provider.",
    "api/v1/auth/verify-email/": "Successful verification sends welcome email through the production email provider.",
    "api/v1/auth/resend-verification/": "Sends email through the production email provider.",
    "api/v1/auth/request-password-reset/": "Sends email through the production email provider.",
    "api/v1/accounts/social-login/": "Calls the Kakao OAuth provider.",
    "api/v1/accounts/complete-kakao-signup/": "Validates credentials with the Kakao OAuth provider.",
    "api/v1/accounts/social-login/v2/": "Calls Kakao, Google, or Apple OAuth providers.",
    "api/v1/accounts/complete-social-signup/": "May validate credentials with an external OAuth provider.",
    "api/v1/accounts/link-social/": "Links an account after calling an external OAuth provider.",
    "api/v1/accounts/merge-accounts/": "The social-account merge flow calls an external OAuth provider.",
    "api/v1/accounts/send-verification/": "Sends email through the production email provider.",
    "api/v1/accounts/verify-email/": "Successful verification sends welcome email through the production email provider.",
    "api/v1/accounts/resend-verification/": "Sends email through the production email provider.",
    "api/v1/accounts/request-password-reset/": "Sends email through the production email provider.",
    "api/v1/todos/hasena/sync/": "Cron endpoint fetches Hasena content from an external site.",
    "api/v1/todos/hasena/summary/cron/": "Cron endpoint calls YouTube and the AI summary provider.",
}
