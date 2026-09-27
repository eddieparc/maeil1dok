from django.middleware.csrf import get_token

from .authentication import ACCESS_TOKEN_COOKIE


class AuthCookieCsrfMiddleware:
    """Issue the CSRF pair whenever a response establishes cookie auth."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if ACCESS_TOKEN_COOKIE in response.cookies:
            response['X-CSRFToken'] = get_token(request)
        return response

