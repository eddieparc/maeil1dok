from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import EmailVerificationToken, PasswordResetToken

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class AccountSecurityApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_link_social_requires_signed_user_bound_state(self):
        user = User.objects.create_user(
            username="link-state-reader",
            nickname="연결상태독자",
            email="link-state@example.com",
        )
        self.client.force_authenticate(user=user)

        missing_state = self.client.post(
            "/api/v1/auth/link-social/",
            {"provider": "kakao", "access_token": "attacker-token"},
            format="json",
        )

        self.assertEqual(missing_state.status_code, 400)
        self.assertIn("유효하지 않은 계정 연결 요청", missing_state.data["error"])

        issued_state = self.client.post("/api/v1/auth/oauth/link-state/", {}, format="json")
        self.assertEqual(issued_state.status_code, 200)
        self.assertIsInstance(issued_state.data["state"], str)

    def test_legacy_register_uses_configured_password_validators(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {"username": "weak-register", "nickname": "약한가입", "password": "12345678"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="weak-register").exists())

    def test_password_reset_uses_configured_password_validators(self):
        user = User.objects.create_user(
            username="reset-validator-reader",
            nickname="재설정검증독자",
            email="reset-validator@example.com",
            password="reset-pass-123",
            has_usable_password_flag=True,
        )
        token = PasswordResetToken.create_token(user)

        response = self.client.post(
            "/api/v1/auth/reset-password/",
            {"token": token.token, "new_password": "12345678"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password("reset-pass-123"))

    def test_password_reset_rejects_inactive_user(self):
        user = User.objects.create_user(
            username="inactive-reset-reader",
            nickname="비활성재설정독자",
            email="inactive-reset@example.com",
            password="reset-pass-123",
            has_usable_password_flag=True,
            is_active=False,
        )
        token = PasswordResetToken.create_token(user)

        response = self.client.post(
            "/api/v1/auth/reset-password/",
            {"token": token.token, "new_password": "NewReset123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비활성화", response.data["error"])
        user.refresh_from_db()
        self.assertTrue(user.check_password("reset-pass-123"))

    def test_email_verification_rejects_inactive_user_without_issuing_tokens(self):
        user = User.objects.create_user(
            username="inactive-verify-reader",
            nickname="비활성인증독자",
            email="inactive-verify@example.com",
            is_active=False,
        )
        token = EmailVerificationToken.create_token(user, user.email)

        response = self.client.post(
            "/api/v1/auth/verify-email/",
            {"token": token.token},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비활성화", response.data["error"])
        self.assertNotIn("access_token", response.cookies)

    def test_duplicate_email_password_reset_returns_generic_without_targeting_user(self):
        for username in ["duplicate-email-a", "duplicate-email-b"]:
            User.objects.create_user(
                username=username,
                nickname=f"{username}-nick",
                email="duplicate-reset@example.com",
                password="ResetPass123",
                has_usable_password_flag=True,
            )

        response = self.client.post(
            "/api/v1/auth/request-password-reset/",
            {"email": "duplicate-reset@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(PasswordResetToken.objects.exists())

    def test_duplicate_email_verification_returns_generic_without_targeting_user(self):
        for username in ["duplicate-verify-a", "duplicate-verify-b"]:
            User.objects.create_user(
                username=username,
                nickname=f"{username}-nick",
                email="duplicate-verify@example.com",
            )

        response = self.client.post(
            "/api/v1/auth/send-verification/",
            {"email": "duplicate-verify@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(EmailVerificationToken.objects.exists())

    def test_session_bridge_consume_rejects_user_deactivated_after_issue(self):
        user = User.objects.create_user(
            username="bridge-inactive-reader",
            nickname="브리지비활성독자",
            email="bridge-inactive@example.com",
            password="BridgePass123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=user)
        issue_response = self.client.post("/api/v1/auth/session/issue/", {}, format="json")
        self.assertEqual(issue_response.status_code, 200)

        user.is_active = False
        user.save(update_fields=["is_active"])
        self.client.force_authenticate(user=None)

        consume_response = self.client.get(
            "/api/v1/auth/session/consume/",
            {"code": issue_response.data["code"]},
        )

        self.assertEqual(consume_response.status_code, 302)
        self.assertIn("reason=inactive_user", consume_response["Location"])

    def test_profile_update_validates_serializer_fields(self):
        user = User.objects.create_user(
            username="profile-validator-reader",
            nickname="프로필검증독자",
            email="profile-validator@example.com",
        )
        self.client.force_authenticate(user=user)

        response = self.client.put(
            "/api/v1/auth/profile/",
            {"bio": "x" * 501},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
