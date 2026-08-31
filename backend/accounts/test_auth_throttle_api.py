from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from .throttles import LoginThrottle


User = get_user_model()

THROTTLE_TEST_REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "login": "1/min",
    },
}


@override_settings(
    ROOT_URLCONF="config.test_urls",
    REST_FRAMEWORK=THROTTLE_TEST_REST_FRAMEWORK,
)
class LoginThrottleCoverageTests(TestCase):
    def setUp(self):
        cache.clear()
        self._previous_throttle_rates = LoginThrottle.THROTTLE_RATES
        LoginThrottle.THROTTLE_RATES = {
            **self._previous_throttle_rates,
            "login": "1/min",
        }
        self.user = User.objects.create_user(
            username="throttle-reader",
            nickname="스로틀독자",
            password="CorrectPass123",
            email="throttle@example.com",
            has_usable_password_flag=True,
        )

    def tearDown(self):
        LoginThrottle.THROTTLE_RATES = self._previous_throttle_rates
        cache.clear()

    def _client(self, remote_addr):
        return APIClient(REMOTE_ADDR=remote_addr)

    def test_cookie_token_login_throttles_repeated_bad_credentials(self):
        client = self._client("10.10.0.1")
        payload = {"username": self.user.username, "password": "wrong-password"}

        first_response = client.post("/api/v1/auth/token/", payload, format="json")
        second_response = client.post("/api/v1/auth/token/", payload, format="json")

        self.assertNotEqual(first_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_legacy_login_route_uses_same_login_throttle(self):
        client = self._client("10.10.0.2")
        payload = {"username": self.user.username, "password": "wrong-password"}

        first_response = client.post("/api/v1/auth/login/", payload, format="json")
        second_response = client.post("/api/v1/auth/login/", payload, format="json")

        self.assertNotEqual(first_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_email_login_still_uses_login_throttle(self):
        client = self._client("10.10.0.3")
        payload = {"email": self.user.email, "password": "wrong-password"}

        first_response = client.post("/api/v1/auth/email-login/", payload, format="json")
        second_response = client.post("/api/v1/auth/email-login/", payload, format="json")

        self.assertNotEqual(first_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_social_login_v2_uses_login_throttle(self):
        client = self._client("10.10.0.4")
        payload = {"provider": "kakao"}

        first_response = client.post(
            "/api/v1/auth/social-login/v2/",
            payload,
            format="json",
        )
        second_response = client.post(
            "/api/v1/auth/social-login/v2/",
            payload,
            format="json",
        )

        self.assertNotEqual(first_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
