"""The refresh endpoint must not lock out a client that proves it holds the token.

Measured in production 2026-08-30: **every** refresh redemption was answered
`403 cause=csrf`. The shell sends its stored token in the request body AND, because
`sharedCookiesEnabled` puts the refresh cookie in the native store, `credentials:
'include'` attaches the cookie too. The view saw a cookie, ran the CSRF check, and
rejected -- the body token was never read.

A native `fetch` has no `Origin` and no `Referer`, so Django's CSRF check can never
pass for it. The session therefore survived only on the one-hour access cookie, and
users were signed out every hour.

The rule these tests fix in place:

- A request that **presents the token in the body** is not a CSRF. An attacker who
  can make the browser send a request cannot read the `HttpOnly` refresh cookie, so
  it cannot produce that body. Possession of the secret is the proof.
- A request that authenticates **by cookie alone** still requires CSRF. That is the
  ambient-authority case the protection exists for, and it is not relaxed here.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.middleware.csrf import get_token
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient

from accounts.authentication import REFRESH_TOKEN_COOKIE, get_tokens_for_user


class RefreshCsrfContractTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="refresh-csrf", email="refresh-csrf@example.test", password="pw-12345"
        )
        self.tokens = get_tokens_for_user(self.user)
        # CSRF must actually run; the default test client disables it and would
        # make every case below pass for the wrong reason.
        self.client = APIClient(enforce_csrf_checks=True)
        self.url = "/api/v1/auth/token/refresh/"

    def _valid_csrf(self):
        token = get_token(RequestFactory().get("/"))
        self.client.cookies[settings.CSRF_COOKIE_NAME] = token
        return token

    def test_body_token_is_accepted_without_a_csrf_header(self):
        """The shell's exact request shape: body token + cookie + no CSRF header."""
        self.client.cookies[REFRESH_TOKEN_COOKIE] = self.tokens["refresh"]

        response = self.client.post(
            self.url, {"refresh": self.tokens["refresh"]}, format="json"
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("access", response.data)

    def test_cookie_only_redemption_still_requires_csrf(self):
        """The protection is not widened away -- ambient-authority use still fails."""
        self.client.cookies[REFRESH_TOKEN_COOKIE] = self.tokens["refresh"]

        response = self.client.post(self.url, {}, format="json")

        self.assertEqual(response.status_code, 403, response.content)

    def test_cookie_only_redemption_succeeds_with_a_valid_csrf_header(self):
        """The web path, which sends no body, keeps working."""
        token = self._valid_csrf()
        self.client.cookies[REFRESH_TOKEN_COOKIE] = self.tokens["refresh"]

        response = self.client.post(self.url, {}, format="json", HTTP_X_CSRFTOKEN=token)

        self.assertEqual(response.status_code, 200, response.content)

    def test_a_forged_body_token_is_still_rejected(self):
        """Skipping CSRF for body tokens must not weaken authentication itself."""
        self.client.cookies[REFRESH_TOKEN_COOKIE] = self.tokens["refresh"]

        response = self.client.post(self.url, {"refresh": "not.a.real.token"}, format="json")

        self.assertEqual(response.status_code, 401, response.content)
