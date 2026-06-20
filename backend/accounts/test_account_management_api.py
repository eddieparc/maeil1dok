from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.authentication import InactiveUserTokenError, get_tokens_for_user
from accounts.models import SocialAccount

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
