from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import EmailVerificationToken, PasswordResetToken, SocialAccount
from accounts.authentication import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE
from accounts.views import (
    OAUTH_TIMEOUT,
    OAuthProviderError,
    SIGNUP_TOKEN_SALT,
    _consume_session_bridge_user_id,
    generate_signup_token,
    get_kakao_user_info,
)
from todos.models import BibleReadingPlan

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

    def test_kakao_social_login_v2_rejects_missing_provider_id_without_creating_none_identity(self):
        with (
            patch("accounts.views.requests.get") as requests_get,
            self.assertLogs("accounts.views", level="ERROR") as logs,
        ):
            requests_get.return_value = JsonResponseStub(
                {"error": "invalid_token", "access_token": "provider-secret-token"}
            )

            response = self.client.post(
                "/api/v1/auth/social-login/v2/",
                {"provider": "kakao", "access_token": "bad-token", "auto_signup": True},
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "로그인 처리 중 오류가 발생했습니다.")
        self.assertFalse(User.objects.filter(username="kakao_None").exists())
        self.assertNotIn("provider-secret-token", "\n".join(logs.output))

    @override_settings(KAKAO_CLIENT_ID="kakao-client", KAKAO_REDIRECT_URI="https://app.example/callback")
    def test_kakao_code_exchange_fails_closed_without_logging_provider_token_payload(self):
        with patch("accounts.views.requests.post") as requests_post:
            requests_post.return_value = JsonResponseStub(
                {"error": "invalid_grant", "refresh_token": "provider-secret-token"}
            )

            with self.assertRaises(OAuthProviderError) as raised:
                get_kakao_user_info("bad-code")

        self.assertEqual(str(raised.exception), "Kakao OAuth failed: missing access_token")
        self.assertNotIn("provider-secret-token", str(raised.exception))
        requests_post.assert_called_once()
        self.assertEqual(requests_post.call_args.kwargs["timeout"], OAUTH_TIMEOUT)

    def test_complete_social_signup_signed_token_ignores_client_supplied_email_claims(self):
        token = generate_signup_token(
            "kakao",
            "provider-123",
            email="provider@example.com",
            profile_image="https://provider.example/avatar.png",
        )

        response = self.client.post(
            "/api/v1/auth/complete-social-signup/",
            {
                "signup_token": token,
                "nickname": "공급자메일독자",
                "email": "attacker@example.com",
                "profile_image": "https://attacker.example/avatar.png",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(username="kakao_provider-123")
        social_account = user.social_accounts.get(provider="kakao")
        self.assertEqual(user.email, "provider@example.com")
        self.assertTrue(user.email_verified)
        self.assertEqual(user.profile_image, "https://provider.example/avatar.png")
        self.assertEqual(social_account.email, "provider@example.com")
        self.assertEqual(social_account.profile_image, "https://provider.example/avatar.png")

    def test_complete_social_signup_legacy_signed_token_does_not_trust_client_email(self):
        token = signing.dumps(
            {"provider": "kakao", "provider_id": "old-token-123"},
            salt=SIGNUP_TOKEN_SALT,
        )

        response = self.client.post(
            "/api/v1/auth/complete-social-signup/",
            {
                "signup_token": token,
                "nickname": "옛토큰독자",
                "email": "attacker-old-token@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(username="kakao_old-token-123")
        self.assertEqual(user.email, "")
        self.assertFalse(user.email_verified)
        self.assertEqual(user.social_accounts.get(provider="kakao").email, "")

    def test_complete_social_signup_legacy_reverification_ignores_client_supplied_email_claims(self):
        with patch("accounts.views.get_kakao_user_info_by_token") as get_user_info:
            get_user_info.return_value = {
                "id": "legacy-123",
                "kakao_account": {"email": "provider-legacy@example.com"},
                "properties": {"profile_image": "https://provider.example/legacy.png"},
            }

            response = self.client.post(
                "/api/v1/auth/complete-social-signup/",
                {
                    "provider": "kakao",
                    "provider_id": "legacy-123",
                    "access_token": "provider-token",
                    "nickname": "레거시메일독자",
                    "email": "attacker-legacy@example.com",
                    "profile_image": "https://attacker.example/legacy.png",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(username="kakao_legacy-123")
        social_account = user.social_accounts.get(provider="kakao")
        self.assertEqual(user.email, "provider-legacy@example.com")
        self.assertTrue(user.email_verified)
        self.assertEqual(user.profile_image, "https://provider.example/legacy.png")
        self.assertEqual(social_account.email, "provider-legacy@example.com")

    def test_complete_kakao_signup_uses_provider_claims_not_client_claims(self):
        with patch("accounts.views.get_kakao_user_info_by_token") as get_user_info:
            get_user_info.return_value = {
                "id": "kakao-signup-123",
                "kakao_account": {"email": "provider-kakao@example.com"},
                "properties": {"profile_image": "https://provider.example/kakao.png"},
            }

            response = self.client.post(
                "/api/v1/auth/complete-kakao-signup/",
                {
                    "nickname": "카카오검증독자",
                    "kakao_id": "kakao-signup-123",
                    "access_token": "provider-token",
                    "email": "attacker-kakao@example.com",
                    "profile_image": "https://attacker.example/kakao.png",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        user = User.objects.get(username="kakao_kakao-signup-123")
        self.assertEqual(user.email, "provider-kakao@example.com")
        self.assertTrue(user.email_verified)
        self.assertEqual(user.profile_image, "https://provider.example/kakao.png")

    def test_complete_kakao_signup_rolls_back_user_when_default_subscription_fails(self):
        plan_owner = User.objects.create_user(
            username="kakao-plan-owner",
            nickname="카카오플랜관리자",
        )
        BibleReadingPlan.objects.create(
            name="카카오 기본 플랜",
            is_default=True,
            created_by=plan_owner,
        )

        with (
            patch("accounts.views.get_kakao_user_info_by_token") as get_user_info,
            patch(
                "accounts.views.PlanSubscription.objects.create",
                side_effect=IntegrityError("subscription write failed"),
            ),
        ):
            get_user_info.return_value = {
                "id": "kakao-rollback-123",
                "kakao_account": {"email": "provider-kakao-rollback@example.com"},
                "properties": {"profile_image": "https://provider.example/kakao-rollback.png"},
            }

            response = self.client.post(
                "/api/v1/auth/complete-kakao-signup/",
                {
                    "nickname": "카카오롤백독자",
                    "kakao_id": "kakao-rollback-123",
                    "access_token": "provider-token",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("subscription write failed", str(response.data))
        self.assertFalse(User.objects.filter(username="kakao_kakao-rollback-123").exists())

    def test_social_login_v2_auto_signup_rolls_back_user_and_social_account_when_default_subscription_fails(self):
        with (
            patch("accounts.views.get_kakao_user_info_by_token") as get_user_info,
            patch(
                "accounts.views._create_default_subscription",
                side_effect=IntegrityError("subscription write failed"),
            ),
        ):
            get_user_info.return_value = {
                "id": "auto-rollback-123",
                "kakao_account": {"email": "provider-auto-rollback@example.com"},
                "properties": {
                    "nickname": "자동롤백독자",
                    "profile_image": "https://provider.example/auto-rollback.png",
                },
            }

            response = self.client.post(
                "/api/v1/auth/social-login/v2/",
                {
                    "provider": "kakao",
                    "access_token": "provider-token",
                    "auto_signup": True,
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("subscription write failed", str(response.data))
        self.assertFalse(User.objects.filter(username="kakao_auto-rollback-123").exists())
        self.assertFalse(
            SocialAccount.objects.filter(
                provider="kakao",
                provider_id="auto-rollback-123",
            ).exists()
        )

    def test_legacy_register_uses_configured_password_validators(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {"username": "weak-register", "nickname": "약한가입", "password": "12345678"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="weak-register").exists())

    def test_legacy_register_rolls_back_user_when_default_subscription_fails(self):
        plan_owner = User.objects.create_user(
            username="register-plan-owner",
            nickname="가입플랜관리자",
        )
        BibleReadingPlan.objects.create(
            name="기본 플랜",
            is_default=True,
            created_by=plan_owner,
        )

        with (
            self.assertLogs("accounts.views", level="WARNING") as logs,
            patch(
                "accounts.views.PlanSubscription.objects.create",
                side_effect=IntegrityError("subscription write failed"),
            ),
        ):
            response = self.client.post(
                "/api/v1/auth/register/",
                {
                    "username": "rollback-register",
                    "nickname": "롤백가입",
                    "password": "StrongPass123",
                },
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("subscription write failed", str(response.data))
        self.assertNotIn("subscription write failed", "\n".join(logs.output))
        self.assertFalse(User.objects.filter(username="rollback-register").exists())

    def test_username_availability_rejects_missing_and_blank_values(self):
        missing_response = self.client.post(
            "/api/v1/auth/check-username/",
            {},
            format="json",
        )
        blank_response = self.client.post(
            "/api/v1/auth/check-username/",
            {"username": "   "},
            format="json",
        )

        self.assertEqual(missing_response.status_code, 400)
        self.assertEqual(blank_response.status_code, 400)
        self.assertNotEqual(missing_response.data.get("available"), True)
        self.assertNotEqual(blank_response.data.get("available"), True)

    def test_nickname_availability_rejects_missing_and_blank_values(self):
        missing_response = self.client.post(
            "/api/v1/auth/check-nickname/",
            {},
            format="json",
        )
        blank_response = self.client.post(
            "/api/v1/auth/check-nickname/",
            {"nickname": "   "},
            format="json",
        )

        self.assertEqual(missing_response.status_code, 400)
        self.assertEqual(blank_response.status_code, 400)
        self.assertNotEqual(missing_response.data.get("available"), True)
        self.assertNotEqual(blank_response.data.get("available"), True)

    def test_availability_checks_preserve_existing_and_unused_results(self):
        User.objects.create_user(
            username="taken-reader",
            nickname="이미있는독자",
            email="taken-availability@example.com",
        )

        taken_username = self.client.post(
            "/api/v1/auth/check-username/",
            {"username": "taken-reader"},
            format="json",
        )
        unused_username = self.client.post(
            "/api/v1/auth/check-username/",
            {"username": "unused-reader"},
            format="json",
        )
        taken_nickname = self.client.post(
            "/api/v1/auth/check-nickname/",
            {"nickname": "이미있는독자"},
            format="json",
        )
        unused_nickname = self.client.post(
            "/api/v1/auth/check-nickname/",
            {"nickname": "새독자"},
            format="json",
        )

        self.assertEqual(taken_username.status_code, 200)
        self.assertFalse(taken_username.data["available"])
        self.assertEqual(unused_username.status_code, 200)
        self.assertTrue(unused_username.data["available"])
        self.assertEqual(taken_nickname.status_code, 200)
        self.assertFalse(taken_nickname.data["available"])
        self.assertEqual(unused_nickname.status_code, 200)
        self.assertTrue(unused_nickname.data["available"])

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

    def test_password_reset_does_not_change_password_when_token_consumption_loses_race(self):
        user = User.objects.create_user(
            username="reset-race-reader",
            nickname="재설정경쟁독자",
            email="reset-race@example.com",
            password="reset-pass-123",
            has_usable_password_flag=True,
        )
        token = PasswordResetToken.create_token(user)

        with patch("accounts.models.PasswordResetToken.use_token", return_value=False):
            response = self.client.post(
                "/api/v1/auth/reset-password/",
                {"token": token.token, "new_password": "NewReset123"},
                format="json",
            )

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password("reset-pass-123"))

    def test_password_reset_token_consumption_is_single_use_for_stale_instances(self):
        user = User.objects.create_user(
            username="reset-stale-reader",
            nickname="재설정재사용독자",
            email="reset-stale@example.com",
            password="reset-pass-123",
            has_usable_password_flag=True,
        )
        first_instance = PasswordResetToken.create_token(user)
        stale_instance = PasswordResetToken.objects.get(pk=first_instance.pk)

        self.assertTrue(first_instance.use_token())
        self.assertFalse(stale_instance.use_token())

    def test_email_verification_token_consumption_is_single_use_for_stale_instances(self):
        user = User.objects.create_user(
            username="verify-stale-reader",
            nickname="인증재사용독자",
            email="verify-stale@example.com",
        )
        first_instance = EmailVerificationToken.create_token(user, user.email)
        stale_instance = EmailVerificationToken.objects.get(pk=first_instance.pk)

        self.assertTrue(first_instance.verify())
        self.assertFalse(stale_instance.verify())

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

    def test_inactive_duplicate_email_password_reset_targets_only_active_user(self):
        User.objects.create_user(
            username="duplicate-email-inactive",
            nickname="duplicate-email-inactive-nick",
            email="duplicate-reset@example.com",
            password="ResetPass123",
            has_usable_password_flag=True,
            is_active=False,
        )
        active_user = User.objects.create_user(
            username="duplicate-email-active",
            nickname="duplicate-email-active-nick",
            email="duplicate-reset@example.com",
            password="ResetPass123",
            has_usable_password_flag=True,
        )

        response = self.client.post(
            "/api/v1/auth/request-password-reset/",
            {"email": "DUPLICATE-RESET@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        token = PasswordResetToken.objects.get()
        self.assertEqual(token.user, active_user)

    def test_inactive_duplicate_email_verification_targets_only_active_user(self):
        User.objects.create_user(
            username="duplicate-verify-inactive",
            nickname="duplicate-verify-inactive-nick",
            email="duplicate-verify@example.com",
            is_active=False,
        )
        active_user = User.objects.create_user(
            username="duplicate-verify-active",
            nickname="duplicate-verify-active-nick",
            email="duplicate-verify@example.com",
        )

        response = self.client.post(
            "/api/v1/auth/send-verification/",
            {"email": "DUPLICATE-VERIFY@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        token = EmailVerificationToken.objects.get()
        self.assertEqual(token.user, active_user)

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

    def test_session_bridge_issue_rejects_deletion_scheduled_user(self):
        user = User.objects.create_user(
            username="bridge-delete-issue-reader",
            nickname="브리지삭제발급독자",
            email="bridge-delete-issue@example.com",
            password="BridgePass123",
            has_usable_password_flag=True,
            scheduled_deletion_at=timezone.now() + timedelta(days=29),
        )
        self.client.force_authenticate(user=user)

        response = self.client.post("/api/v1/auth/session/issue/", {}, format="json")
        self.client.force_authenticate(user=None)

        self.assertEqual(response.status_code, 403)
        self.assertIn("삭제 예정", response.data["error"])
        self.assertNotIn("code", response.data)

    def test_session_bridge_consume_rejects_deletion_scheduled_user(self):
        user = User.objects.create_user(
            username="bridge-delete-consume-reader",
            nickname="브리지삭제소비독자",
            email="bridge-delete-consume@example.com",
            password="BridgePass123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=user)
        issue_response = self.client.post("/api/v1/auth/session/issue/", {}, format="json")
        self.assertEqual(issue_response.status_code, 200)

        user.scheduled_deletion_at = timezone.now() + timedelta(days=29)
        user.save(update_fields=["scheduled_deletion_at"])
        self.client.force_authenticate(user=None)

        consume_response = self.client.get(
            "/api/v1/auth/session/consume/",
            {"code": issue_response.data["code"]},
        )

        self.assertEqual(consume_response.status_code, 302)
        self.assertIn("reason=inactive_user", consume_response["Location"])
        self.assertNotIn(ACCESS_TOKEN_COOKIE, consume_response.cookies)
        self.assertNotIn(REFRESH_TOKEN_COOKIE, consume_response.cookies)

    def test_session_bridge_consume_rejects_malformed_code_before_cache_lookup(self):
        with patch("django.core.cache.cache.add") as cache_add:
            response = self.client.get(
                "/api/v1/auth/session/consume/",
                {"code": "not-a-uuid"},
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("reason=invalid_code", response["Location"])
        self.assertNotIn(ACCESS_TOKEN_COOKIE, response.cookies)
        cache_add.assert_not_called()

    def test_session_bridge_consume_lost_atomic_race_does_not_issue_cookies(self):
        user = User.objects.create_user(
            username="bridge-race-reader",
            nickname="브리지경쟁독자",
            email="bridge-race@example.com",
            password="BridgePass123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=user)
        issue_response = self.client.post("/api/v1/auth/session/issue/", {}, format="json")
        self.assertEqual(issue_response.status_code, 200)
        self.client.force_authenticate(user=None)

        with patch("django.core.cache.cache.add", return_value=False):
            response = self.client.get(
                "/api/v1/auth/session/consume/",
                {"code": issue_response.data["code"]},
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("reason=invalid_code", response["Location"])
        self.assertNotIn(ACCESS_TOKEN_COOKIE, response.cookies)
        self.assertNotIn(REFRESH_TOKEN_COOKIE, response.cookies)

    def test_session_bridge_code_helper_is_single_winner(self):
        class BridgeCacheStub:
            def __init__(self):
                self.values = {"session_bridge:123e4567-e89b-12d3-a456-426614174000": 7}
                self.consumed = set()

            def add(self, key, value, timeout=None):
                if key in self.consumed:
                    return False
                self.consumed.add(key)
                return True

            def get(self, key):
                return self.values.get(key)

            def delete(self, key):
                self.values.pop(key, None)

        cache = BridgeCacheStub()
        code = "123e4567-e89b-12d3-a456-426614174000"

        self.assertEqual(_consume_session_bridge_user_id(cache, code), 7)
        self.assertIsNone(_consume_session_bridge_user_id(cache, code))

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

    def test_social_only_session_cannot_create_first_password_without_fresh_proof(self):
        user = User.objects.create_user(
            username="social-password-reader",
            nickname="소셜비번독자",
            email="social-password@example.com",
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/v1/auth/set-password/",
            {
                "new_password": "FreshPass123",
                "new_password_confirm": "FreshPass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비밀번호 재설정", response.data["error"])
        user.refresh_from_db()
        self.assertFalse(user.has_password_set())

    def test_social_only_session_cannot_change_account_email_without_fresh_proof(self):
        user = User.objects.create_user(
            username="social-email-reader",
            nickname="소셜이메일독자",
            email="social-email@example.com",
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/v1/auth/account-email/",
            {"email": "attacker-controlled@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비밀번호", response.data["error"])
        user.refresh_from_db()
        self.assertEqual(user.email, "social-email@example.com")
        self.assertTrue(user.email_verified)


class JsonResponseStub:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        return self.payload
