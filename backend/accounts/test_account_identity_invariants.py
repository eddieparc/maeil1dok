from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient


User = get_user_model()


class ActiveEmailIdentityConstraintTests(TestCase):
    def test_active_duplicate_normalized_email_rejected(self):
        User.objects.create_user(
            username="active-email-one",
            nickname="활성메일하나",
            email="reader@example.com",
        )

        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                username="active-email-two",
                nickname="활성메일둘",
                email="READER@example.com",
            )

    def test_inactive_duplicate_email_allowed(self):
        User.objects.create_user(
            username="inactive-email-one",
            nickname="비활성메일하나",
            email="reader@example.com",
            is_active=False,
        )

        second_user = User.objects.create_user(
            username="inactive-email-two",
            nickname="비활성메일둘",
            email="READER@example.com",
        )

        self.assertEqual(second_user.email, "READER@example.com")

    def test_blank_and_null_emails_do_not_create_identity_key(self):
        first_user = User.objects.create_user(
            username="blank-email-one",
            nickname="빈메일하나",
            email="",
        )
        second_user = User.objects.create_user(
            username="blank-email-two",
            nickname="빈메일둘",
            email=None,
        )

        self.assertEqual(first_user.email, "")
        self.assertEqual(second_user.email, "")
        self.assertEqual(
            User.objects.filter(active_email_identity__isnull=True).count(),
            2,
        )


@override_settings(ROOT_URLCONF="config.urls")
class ActiveEmailIdentityLiveHttpTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_email_register_duplicate_normalized_email_returns_400(self):
        first_response = self.client.post(
            "/api/v1/auth/email-register/",
            {
                "email": "reader@example.com",
                "password": "StrongPass123",
                "password_confirm": "StrongPass123",
                "nickname": "중복메일하나",
            },
            format="json",
        )

        second_response = self.client.post(
            "/api/v1/auth/email-register/",
            {
                "email": "READER@example.com",
                "password": "StrongPass123",
                "password_confirm": "StrongPass123",
                "nickname": "중복메일둘",
            },
            format="json",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 400)
        self.assertEqual(second_response.data["error"], "이미 사용 중인 이메일입니다.")
        self.assertEqual(
            User.objects.filter(email__iexact="reader@example.com", is_active=True).count(),
            1,
        )

    def test_email_register_allows_email_held_only_by_inactive_user(self):
        User.objects.create_user(
            username="inactive-legacy-reader",
            nickname="비활성기존메일",
            email="reader@example.com",
            is_active=False,
        )

        response = self.client.post(
            "/api/v1/auth/email-register/",
            {
                "email": " READER@example.com ",
                "password": "StrongPass123",
                "password_confirm": "StrongPass123",
                "nickname": "활성신규메일",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            User.objects.filter(email__iexact="reader@example.com", is_active=True).count(),
            1,
        )

    def test_email_register_rolls_back_user_when_default_subscription_fails(self):
        with patch(
            "accounts.views._create_default_subscription",
            side_effect=IntegrityError("subscription write failed"),
        ):
            response = self.client.post(
                "/api/v1/auth/email-register/",
                {
                    "email": "rollback@example.com",
                    "password": "StrongPass123",
                    "password_confirm": "StrongPass123",
                    "nickname": "롤백회원가입",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="rollback@example.com").exists())

    def test_email_login_accepts_case_variant_identifier(self):
        User.objects.create_user(
            username="case-login-reader",
            nickname="대소문자로그인",
            email="reader@example.com",
            password="StrongPass123",
            has_usable_password_flag=True,
        )

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "READER@example.com", "password": "StrongPass123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
