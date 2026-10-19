"""Session consume preserves relative feature destinations, never absolute URLs."""

import json
import re

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.authentication import get_tokens_for_user


@override_settings(FRONTEND_URL="https://maeil1dok.app")
class SessionBridgeNextTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = get_user_model().objects.create_user(
            username="bridge-next", email="bridge-next@example.test", password="pw-12345"
        )
        self.tokens = get_tokens_for_user(self.user)
        self.client = APIClient()

    def _consume(self, destination):
        issued = self.client.post(
            "/api/v1/auth/session/issue/", {}, format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}",
        )
        self.assertEqual(issued.status_code, 200, issued.content)
        response = self.client.get(
            "/api/v1/auth/session/consume/",
            {"code": issued.data["code"], "next": destination},
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        match = re.search(r"window\.location\.replace\((.*?)\);", response.content.decode())
        assert match is not None, response.content
        target = json.loads(match.group(1))
        self.assertNotIn(issued.data["code"], target)
        self.assertNotIn(self.tokens["access"], target)
        self.assertNotIn(self.tokens["refresh"], target)
        return target

    def test_relative_feature_destination_survives_consume(self):
        destination = "/groups/42/board?sort=recent&tag=a%26b#post-7"
        self.assertEqual(
            self._consume(destination), "https://maeil1dok.app" + destination
        )

    def test_unsafe_destinations_fall_back_to_frontend_root(self):
        for destination in (
            "https://maeil1dok.app/groups/42/board?sort=recent#post-7",
            "https://evil.example/phishing",
            "//evil.example/phishing",
            "/\\evil.example/phishing",
            "/bible?redirect=\\evil.example",
        ):
            with self.subTest(destination=destination):
                self.assertEqual(self._consume(destination), "https://maeil1dok.app")
