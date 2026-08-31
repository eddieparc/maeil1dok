"""The session bridge must hand the web a CSRF token, not just auth cookies.

Measured in production 2026-08-30. A shell user signs in natively; the shell then
calls `/auth/session/issue/` and points the webview at `/auth/session/consume/`,
which sets the auth cookies and redirects to the web app. The web app therefore
**never sees a login response**, and login is the only place that returns
`X-CSRFToken`.

So the web starts with no CSRF token at all. Its five-minute refresh timer fires,
sends a cookie-only redemption with no `X-CSRFToken` header, and is answered 403.
That 403 used to sign the user out; it no longer does, but the round trip is still
wasted and the failure still lands in `refresh_401{cause=csrf}` where it looks like
a real problem.

Handing the token over at the bridge removes the cause instead of recovering from
it. `CSRF_COOKIE_DOMAIN` is `.maeil1dok.app` and `CSRF_COOKIE_HTTPONLY` is False,
so a cookie set here on `api.maeil1dok.app` is readable by the web app's JS on
`maeil1dok.app`.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.middleware.csrf import get_token
from django.test import RequestFactory, TestCase, override_settings
from rest_framework.test import APIClient

from accounts.authentication import ACCESS_TOKEN_COOKIE, get_tokens_for_user

ISSUE_URL = "/api/v1/auth/session/issue/"
CONSUME_URL = "/api/v1/auth/session/consume/"


class SessionBridgeCsrfCookieTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(
            username="bridge-csrf", email="bridge-csrf@example.test", password="pw-12345"
        )
        self.tokens = get_tokens_for_user(self.user)
        self.client = APIClient()

    def _issue_code(self):
        response = self.client.post(
            ISSUE_URL, {}, format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}",
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.data["code"]

    def test_consume_hands_the_web_a_csrf_token(self):
        response = self.client.get(CONSUME_URL, {"code": self._issue_code()})

        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn(
            settings.CSRF_COOKIE_NAME,
            response.cookies,
            "the bridged webview has no other way to obtain a CSRF token: it never "
            "receives a login response",
        )
        self.assertTrue(response.cookies[settings.CSRF_COOKIE_NAME].value)

    def test_the_csrf_cookie_is_readable_by_the_web_app(self):
        # A cookie the browser cannot read from `maeil1dok.app`, or that JS cannot
        # see at all, would satisfy the test above while fixing nothing.
        response = self.client.get(CONSUME_URL, {"code": self._issue_code()})

        cookie = response.cookies[settings.CSRF_COOKIE_NAME]
        self.assertFalse(cookie["httponly"], "the web reads this token with JS")
        self.assertEqual(cookie["domain"], settings.CSRF_COOKIE_DOMAIN or "")

    def test_the_auth_cookies_are_still_set(self):
        # The bridge's existing job must not regress.
        response = self.client.get(CONSUME_URL, {"code": self._issue_code()})

        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

    def test_explicit_bearer_wins_over_ambient_cookie_without_csrf(self):
        """Native shell shape: login cookie + explicit access token, no CSRF cookie."""
        client = APIClient(enforce_csrf_checks=True)
        client.cookies[ACCESS_TOKEN_COOKIE] = self.tokens["access"]

        response = client.post(
            ISSUE_URL,
            {},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("code", response.data)

    def test_invalid_explicit_bearer_cannot_fall_back_to_cookie_user(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf_secret = get_token(RequestFactory().get("/"))
        client.cookies[ACCESS_TOKEN_COOKIE] = self.tokens["access"]
        client.cookies[settings.CSRF_COOKIE_NAME] = csrf_secret

        response = client.post(
            ISSUE_URL,
            {},
            format="json",
            HTTP_AUTHORIZATION="Bearer malformed",
            HTTP_X_CSRFTOKEN=csrf_secret,
        )

        self.assertEqual(response.status_code, 401, response.content)

    @override_settings(FRONTEND_URL="https://qa.example.test")
    def test_consume_uses_the_configured_frontend_origin(self):
        response = self.client.get(
            CONSUME_URL,
            {"code": self._issue_code(), "next": "/after-login"},
        )

        self.assertContains(
            response,
            'window.location.replace("https://qa.example.test/after-login")',
        )
