from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.authentication import InactiveUserTokenError, get_tokens_for_user
from accounts.models import SocialAccount, UserReadingSettings
from accounts.views import generate_social_merge_token, generate_oauth_link_state
from todos.models import NotificationSettings

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class AccountManagementApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_email_login_restores_account_when_scheduled_deletion_is_in_grace_period(self):
        user = User.objects.create_user(
            username="delete-grace-reader",
            nickname="삭제복구독자",
            email="restore@example.com",
            password="restore-pass-123",
            has_usable_password_flag=True,
            is_active=False,
            scheduled_deletion_at=timezone.now() + timedelta(days=29),
            token_version=3,
        )

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "restore@example.com", "password": "restore-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNone(user.scheduled_deletion_at)
        self.assertEqual(user.token_version, 4)
        self.assertEqual(response.data["user"]["id"], user.id)

    def test_email_login_rejects_expired_scheduled_deletion_account(self):
        User.objects.create_user(
            username="expired-delete-reader",
            nickname="만료삭제독자",
            email="expired-restore@example.com",
            password="restore-pass-123",
            has_usable_password_flag=True,
            is_active=False,
            scheduled_deletion_at=timezone.now() - timedelta(minutes=1),
            token_version=3,
        )

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "expired-restore@example.com", "password": "restore-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("복구 가능 기간", response.data["error"])

    def test_email_login_rejects_merged_account_restore(self):
        kept_user = User.objects.create_user(
            username="kept-reader",
            nickname="유지독자",
            email="kept@example.com",
        )
        merged_user = User.objects.create_user(
            username="merged-reader",
            nickname="병합독자",
            email="merged@example.com",
            password="restore-pass-123",
            has_usable_password_flag=True,
            is_active=False,
            scheduled_deletion_at=timezone.now() + timedelta(days=29),
            merged_into=kept_user,
            token_version=3,
        )

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "merged@example.com", "password": "restore-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("병합", response.data["error"])
        merged_user.refresh_from_db()
        self.assertFalse(merged_user.is_active)


    def _create_active_and_inactive_duplicate(self):
        active_user = User.objects.create_user(
            username="active-dup-reader",
            nickname="활성중복독자",
            email="dup@example.com",
            password="active-pass-123",
            has_usable_password_flag=True,
            is_active=True,
        )
        inactive_user = User.objects.create_user(
            username="inactive-dup-reader",
            nickname="비활성중복독자",
            email="dup@example.com",
            password="inactive-pass-123",
            has_usable_password_flag=True,
            is_active=False,
            scheduled_deletion_at=timezone.now() + timedelta(days=29),
            token_version=3,
        )
        return active_user, inactive_user

    def test_email_login_active_user_wins_when_inactive_duplicate_email_exists(self):
        active_user, _ = self._create_active_and_inactive_duplicate()

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "dup@example.com", "password": "active-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["id"], active_user.id)

    def test_email_login_inactive_duplicate_password_does_not_receive_tokens_when_active_duplicate_exists(self):
        _, inactive_user = self._create_active_and_inactive_duplicate()

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "dup@example.com", "password": "inactive-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        inactive_user.refresh_from_db()
        self.assertFalse(inactive_user.is_active)

    def test_email_login_active_duplicate_blocks_scheduled_deletion_restore_without_mutation(self):
        active_user, inactive_user = self._create_active_and_inactive_duplicate()

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "dup@example.com", "password": "inactive-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access", response.data)
        active_user.refresh_from_db()
        inactive_user.refresh_from_db()
        self.assertTrue(active_user.is_active)
        self.assertFalse(inactive_user.is_active)
        self.assertIsNotNone(inactive_user.scheduled_deletion_at)
        self.assertEqual(inactive_user.token_version, 3)

    def test_get_tokens_for_user_rejects_inactive_user(self):
        user = User.objects.create_user(
            username="inactive-token-reader",
            nickname="비활성토큰독자",
            email="inactive-token@example.com",
            is_active=False,
        )

        with self.assertRaises(InactiveUserTokenError):
            get_tokens_for_user(user)

    def test_email_login_rejects_inactive_account_without_deletion_recovery(self):
        User.objects.create_user(
            username="inactive-reader",
            nickname="비활성독자",
            email="inactive@example.com",
            password="inactive-pass-123",
            has_usable_password_flag=True,
            is_active=False,
        )

        response = self.client.post(
            "/api/v1/auth/email-login/",
            {"email": "inactive@example.com", "password": "inactive-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비활성화", response.data["error"])

    def test_delete_account_requires_explicit_confirmation_after_password_check(self):
        user = User.objects.create_user(
            username="delete-confirm-reader",
            nickname="삭제확인독자",
            email="delete-confirm@example.com",
            password="delete-pass-123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/v1/auth/delete-account/",
            {"password": "delete-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("삭제 확인", response.data["error"])
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNone(user.scheduled_deletion_at)

    def test_delete_account_schedules_deletion_with_password_and_confirmation(self):
        user = User.objects.create_user(
            username="delete-ready-reader",
            nickname="삭제준비독자",
            email="delete-ready@example.com",
            password="delete-pass-123",
            has_usable_password_flag=True,
            token_version=6,
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/v1/auth/delete-account/",
            {"password": "delete-pass-123", "confirm_delete": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertIsNotNone(user.scheduled_deletion_at)
        self.assertEqual(user.token_version, 7)

    def test_delete_account_requires_password_backed_fresh_proof(self):
        user = User.objects.create_user(
            username="social-delete-reader",
            nickname="소셜삭제독자",
            email="social-delete@example.com",
        )
        SocialAccount.objects.create(
            user=user,
            provider="kakao",
            provider_id="social-delete-1",
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            "/api/v1/auth/delete-account/",
            {"confirm_delete": True},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비밀번호", response.data["error"])

    def test_linked_accounts_reports_auth_methods_and_unlink_safety(self):
        user = User.objects.create_user(
            username="linked-social-reader",
            nickname="연동독자",
            email="reader@example.com",
        )
        SocialAccount.objects.create(
            user=user,
            provider="kakao",
            provider_id="kakao-1",
            email="kakao@example.com",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get("/api/v1/auth/linked-accounts/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["primary_email"], "reader@example.com")
        self.assertEqual(response.data["auth_methods"]["total"], 1)
        self.assertFalse(response.data["auth_methods"]["can_remove_login_method"])
        self.assertEqual(response.data["linked_accounts"][0]["provider"], "kakao")
        self.assertFalse(response.data["linked_accounts"][0]["can_unlink"])

    def test_social_account_allows_only_one_account_per_provider_for_user(self):
        user = User.objects.create_user(
            username="duplicate-provider-reader",
            nickname="제공자중복독자",
            email="duplicate-provider@example.com",
        )
        SocialAccount.objects.create(
            user=user,
            provider="kakao",
            provider_id="kakao-unique-1",
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SocialAccount.objects.create(
                    user=user,
                    provider="kakao",
                    provider_id="kakao-unique-2",
                )

    def test_update_account_email_rejects_duplicate_active_email(self):
        User.objects.create_user(
            username="email-owner",
            nickname="기존이메일독자",
            email="taken@example.com",
            password="owner-pass-123",
            has_usable_password_flag=True,
        )
        user = User.objects.create_user(
            username="email-change-reader",
            nickname="이메일변경독자",
            email="change@example.com",
            password="change-pass-123",
            has_usable_password_flag=True,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/v1/auth/account-email/",
            {"email": "taken@example.com", "current_password": "change-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("이미 사용 중", response.data["error"])
        user.refresh_from_db()
        self.assertEqual(user.email, "change@example.com")
        self.assertTrue(user.email_verified)

    def test_update_account_email_changes_email_and_marks_unverified(self):
        user = User.objects.create_user(
            username="email-update-reader",
            nickname="이메일수정독자",
            email="old@example.com",
            password="update-pass-123",
            has_usable_password_flag=True,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            "/api/v1/auth/account-email/",
            {"email": "new@example.com", "current_password": "update-pass-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.email, "new@example.com")
        self.assertFalse(user.email_verified)
        self.assertEqual(response.data["email"], "new@example.com")
        self.assertFalse(response.data["email_verified"])

    def test_update_account_email_requires_current_password_for_password_user(self):
        user = User.objects.create_user(
            username="email-password-reader",
            nickname="이메일비번독자",
            email="password-old@example.com",
            password="email-pass-123",
            has_usable_password_flag=True,
            email_verified=True,
        )
        self.client.force_authenticate(user=user)

        missing_response = self.client.patch(
            "/api/v1/auth/account-email/",
            {"email": "password-new@example.com"},
            format="json",
        )
        wrong_response = self.client.patch(
            "/api/v1/auth/account-email/",
            {"email": "password-new@example.com", "current_password": "wrong-pass-123"},
            format="json",
        )

        self.assertEqual(missing_response.status_code, 400)
        self.assertEqual(wrong_response.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.email, "password-old@example.com")
        self.assertTrue(user.email_verified)

    def test_merge_password_account_by_email_with_fresh_password_proof(self):
        current_user = User.objects.create_user(
            username="merge-current",
            nickname="현재병합독자",
            email="current-merge@example.com",
            password="current-pass-123",
            has_usable_password_flag=True,
        )
        target_user = User.objects.create_user(
            username="legacy-reader-id",
            nickname="레거시병합독자",
            email="legacy-merge@example.com",
            password="legacy-pass-123",
            has_usable_password_flag=True,
            token_version=5,
        )
        SocialAccount.objects.create(
            user=target_user,
            provider="google",
            provider_id="legacy-google-1",
            email="legacy-google@example.com",
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/auth/merge-accounts/",
            {
                "merge_type": "password",
                "target_identifier": "legacy-merge@example.com",
                "target_password": "legacy-pass-123",
                "keep_account": "current",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        target_user.refresh_from_db()
        self.assertFalse(target_user.is_active)
        self.assertEqual(target_user.merged_into_id, current_user.id)
        self.assertEqual(target_user.token_version, 6)
        self.assertTrue(
            SocialAccount.objects.filter(
                user=current_user,
                provider="google",
                provider_id="legacy-google-1",
            ).exists()
        )

    def test_merge_password_account_keep_other_requires_current_password_before_deactivating_current(self):
        current_user = User.objects.create_user(
            username="merge-current-delete",
            nickname="현재삭제병합독자",
            email="current-delete@example.com",
            password="current-pass-123",
            has_usable_password_flag=True,
            token_version=1,
        )
        target_user = User.objects.create_user(
            username="merge-keep-other",
            nickname="유지대상병합독자",
            email="keep-other@example.com",
            password="target-pass-123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/auth/merge-accounts/",
            {
                "merge_type": "password",
                "target_identifier": "merge-keep-other",
                "target_password": "target-pass-123",
                "keep_account": "other",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("현재 계정 비밀번호", response.data["error"])
        current_user.refresh_from_db()
        target_user.refresh_from_db()
        self.assertTrue(current_user.is_active)
        self.assertIsNone(current_user.merged_into_id)
        self.assertTrue(target_user.is_active)

    def test_merge_password_account_keep_other_returns_tokens_with_current_password(self):
        current_user = User.objects.create_user(
            username="merge-current-proof",
            nickname="현재증명병합독자",
            email="current-proof@example.com",
            password="current-pass-123",
            has_usable_password_flag=True,
            token_version=1,
        )
        target_user = User.objects.create_user(
            username="merge-keep-proof",
            nickname="유지증명병합독자",
            email="keep-proof@example.com",
            password="target-pass-123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/auth/merge-accounts/",
            {
                "merge_type": "password",
                "target_identifier": "merge-keep-proof",
                "target_password": "target-pass-123",
                "current_password": "current-pass-123",
                "keep_account": "other",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["id"], target_user.id)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        current_user.refresh_from_db()
        self.assertFalse(current_user.is_active)
        self.assertEqual(current_user.merged_into_id, target_user.id)
        self.assertEqual(current_user.token_version, 2)

    def test_merge_password_account_keep_other_rejects_wrong_current_password_without_mutation(self):
        current_user = User.objects.create_user(
            username="merge-current-wrong-proof",
            nickname="현재오증명병합독자",
            email="current-wrong-proof@example.com",
            password="current-pass-123",
            has_usable_password_flag=True,
        )
        target_user = User.objects.create_user(
            username="merge-keep-wrong-proof",
            nickname="유지오증명병합독자",
            email="keep-wrong-proof@example.com",
            password="target-pass-123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/auth/merge-accounts/",
            {
                "merge_type": "password",
                "target_identifier": "merge-keep-wrong-proof",
                "target_password": "target-pass-123",
                "current_password": "wrong-current-pass",
                "keep_account": "other",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("현재 계정 비밀번호", response.data["error"])
        current_user.refresh_from_db()
        target_user.refresh_from_db()
        self.assertTrue(current_user.is_active)
        self.assertIsNone(current_user.merged_into_id)
        self.assertTrue(target_user.is_active)

    def test_merge_password_account_rejects_wrong_password(self):
        current_user = User.objects.create_user(
            username="merge-wrong-current",
            nickname="현재오류병합독자",
            email="merge-wrong-current@example.com",
            password="current-pass-123",
            has_usable_password_flag=True,
        )
        target_user = User.objects.create_user(
            username="merge-wrong-target",
            nickname="대상오류병합독자",
            email="merge-wrong-target@example.com",
            password="target-pass-123",
            has_usable_password_flag=True,
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/auth/merge-accounts/",
            {
                "merge_type": "password",
                "target_identifier": "merge-wrong-target",
                "target_password": "wrong-pass-123",
                "keep_account": "current",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("비밀번호", response.data["error"])
        target_user.refresh_from_db()
        self.assertTrue(target_user.is_active)

    def test_link_social_conflict_returns_signed_merge_token(self):
        current_user = User.objects.create_user(
            username="social-current",
            nickname="소셜현재독자",
            email="social-current@example.com",
        )
        other_user = User.objects.create_user(
            username="social-other",
            nickname="소셜기존독자",
            email="social-other@example.com",
        )
        SocialAccount.objects.create(
            user=other_user,
            provider="google",
            provider_id="google-conflict-1",
            email="other-google@example.com",
        )
        self.client.force_authenticate(user=current_user)

        with patch("accounts.views.get_google_user_info") as get_google_user_info:
            get_google_user_info.return_value = {
                "sub": "google-conflict-1",
                "email": "other-google@example.com",
                "picture": "https://example.com/profile.png",
            }
            response = self.client.post(
                "/api/v1/auth/link-social/",
                {
                    "provider": "google",
                    "code": "single-use-code",
                    "state": generate_oauth_link_state(current_user),
                },
                format="json",
            )

        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.data["can_merge"])
        self.assertIsInstance(response.data["merge_token"], str)
        self.assertNotIn("single-use-code", response.data["merge_token"])

    def test_merge_social_account_consumes_merge_token_without_reusing_oauth_code(self):
        current_user = User.objects.create_user(
            username="token-merge-current",
            nickname="토큰현재독자",
            email="token-current@example.com",
        )
        other_user = User.objects.create_user(
            username="token-merge-other",
            nickname="토큰기존독자",
            email="token-other@example.com",
            token_version=2,
        )
        SocialAccount.objects.create(
            user=other_user,
            provider="google",
            provider_id="google-token-1",
            email="token-google@example.com",
        )
        merge_token = generate_social_merge_token(
            current_user,
            "google",
            "google-token-1",
            "token-google@example.com",
            None,
            {"sub": "google-token-1", "email": "token-google@example.com"},
        )
        self.client.force_authenticate(user=current_user)

        with patch("accounts.views.get_google_user_info") as get_google_user_info:
            response = self.client.post(
                "/api/v1/auth/merge-accounts/",
                {"merge_token": merge_token, "keep_account": "current"},
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        get_google_user_info.assert_not_called()
        other_user.refresh_from_db()
        self.assertFalse(other_user.is_active)
        self.assertEqual(other_user.merged_into_id, current_user.id)
        self.assertEqual(other_user.token_version, 3)

    def test_merge_social_account_rejects_invalid_merge_token(self):
        current_user = User.objects.create_user(
            username="invalid-token-current",
            nickname="잘못된토큰현재독자",
            email="invalid-token-current@example.com",
        )
        self.client.force_authenticate(user=current_user)

        response = self.client.post(
            "/api/v1/auth/merge-accounts/",
            {"merge_token": "not-a-valid-signed-token", "keep_account": "current"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("병합", response.data["error"])

    def test_account_notification_settings_round_trip(self):
        user = User.objects.create_user(
            username="notification-reader",
            nickname="알림설정독자",
            email="notification@example.com",
        )
        self.client.force_authenticate(user=user)

        get_response = self.client.get("/api/v1/auth/notification-settings/")
        self.assertEqual(get_response.status_code, 200)
        self.assertTrue(get_response.data["daily_reading_reminder"])
        # This route now reports the row that actually drives delivery
        # (todos.NotificationSettings), so the default is the real reminder hour.
        # It used to report UserReadingSettings.reminder_time, whose 07:00 default
        # no sender ever consulted. See todos/migrations/0033.
        self.assertEqual(get_response.data["reminder_time"], "20:00")

        patch_response = self.client.patch(
            "/api/v1/auth/notification-settings/",
            {
                "daily_reading_reminder": False,
                "weekly_progress_summary": True,
                "service_notice": False,
                "reminder_time": "21:30",
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, 200)
        settings = NotificationSettings.objects.get(user=user)
        self.assertFalse(settings.reading_reminders_enabled)
        self.assertTrue(settings.weekly_summary_enabled)
        self.assertFalse(settings.service_notice_enabled)
        self.assertEqual(settings.reading_reminder_time.strftime("%H:%M"), "21:30")
