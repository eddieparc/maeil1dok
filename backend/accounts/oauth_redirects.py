from typing import Final

from django.conf import settings

PUBLIC_CALLBACK_ORIGINS: Final = (
    "https://maeil1dok.app",
    "https://beta.maeil1dok.app",
)
CALLBACK_PATHS: Final = {
    "apple": "/auth/apple/callback",
    "google": "/auth/google/callback",
    "kakao": "/auth/kakao/callback",
}
CONFIGURED_REDIRECT_SETTINGS: Final = {
    "apple": "APPLE_REDIRECT_URI",
    "google": "GOOGLE_REDIRECT_URI",
    "kakao": "KAKAO_REDIRECT_URI",
}


class InvalidOAuthRedirectURIError(Exception):
    """Raised when a client requests an unapproved OAuth callback."""


def resolve_oauth_redirect_uri(provider: str, requested_uri: str | None) -> str:
    callback_path = CALLBACK_PATHS[provider]
    configured_uri = getattr(
        settings,
        CONFIGURED_REDIRECT_SETTINGS[provider],
        "",
    )
    default_uri = configured_uri or f"{PUBLIC_CALLBACK_ORIGINS[0]}{callback_path}"
    if not requested_uri:
        return default_uri

    allowed_uris = {
        default_uri,
        *(f"{origin}{callback_path}" for origin in PUBLIC_CALLBACK_ORIGINS),
    }
    if requested_uri not in allowed_uris:
        raise InvalidOAuthRedirectURIError
    return requested_uri
