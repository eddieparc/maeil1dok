from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import UserReadingSettings

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class ReadingSettingsValidationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="settings-reader",
            nickname="설정독자",
            password="pw-test-1234",
        )
        self.client.force_authenticate(user=self.user)

    def test_invalid_reading_settings_are_rejected_without_persisting(self):
        settings = UserReadingSettings.objects.create(
            user=self.user,
            font_size=16,
            line_height=1.6,
        )

        response = self.client.patch(
            "/api/v1/accounts/reading-settings/update/",
            {
                "theme": "neon",
                "font_size": 99,
                "line_height": 9.9,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("theme", response.data["errors"])
        self.assertIn("font_size", response.data["errors"])
        self.assertIn("line_height", response.data["errors"])

        settings.refresh_from_db()
        self.assertEqual(settings.theme, "light")
        self.assertEqual(settings.font_size, 16)
        self.assertEqual(settings.line_height, 1.6)

    def test_valid_reading_settings_update_preserves_response_shape(self):
        response = self.client.patch(
            "/api/v1/accounts/reading-settings/update/",
            {
                "theme": "dark",
                "font_size": 18,
                "line_height": 1.8,
                "show_footnotes": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["success"])
        settings = response.data["data"]["settings"]
        self.assertEqual(settings["theme"], "dark")
        self.assertEqual(settings["font_size"], 18)
        self.assertEqual(settings["line_height"], 1.8)
        self.assertTrue(settings["show_footnotes"])


class ReadingSettingsConstraintTests(TestCase):
    def test_database_rejects_out_of_range_reading_settings(self):
        user = User.objects.create_user(
            username="constraint-reader",
            nickname="제약독자",
            password="pw-test-1234",
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            UserReadingSettings.objects.create(
                user=user,
                font_size=25,
                line_height=1.6,
            )
