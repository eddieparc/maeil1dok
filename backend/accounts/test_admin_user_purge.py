from datetime import date

from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.contrib.auth import get_user_model
from django.contrib.messages import get_messages
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import SocialAccount
from todos.models import (
    BibleReadingPlan,
    Notification,
    PersonalReadingRecord,
    PlanSubscription,
)

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class MemberPurgeAdminTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="member-purge-admin",
            nickname="회원정리관리자",
            email="admin@example.com",
            password="admin-pass-123",
        )
        self.client.force_login(self.admin)
        self.url = reverse("admin:accounts_user_changelist")

    def _selection_payload(self, *users, confirmed=False):
        payload = {
            "action": "purge_selected_members",
            ACTION_CHECKBOX_NAME: [str(user.pk) for user in users],
            "select_across": "0",
            "index": "0",
        }
        if confirmed:
            payload["confirm_purge"] = "yes"
        return payload

    def test_purge_action_requires_explicit_confirmation(self):
        # Given
        target = User.objects.create_user(
            username="confirmation-target",
            nickname="확인대상",
            email="confirmation@example.com",
        )

        # When
        response = self.client.post(
            self.url,
            self._selection_payload(target),
        )

        # Then
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(
            response,
            "admin/accounts/user/purge_confirmation.html",
        )
        self.assertContains(response, "영구 삭제")
        self.assertTrue(User.objects.filter(pk=target.pk).exists())

    def test_confirmed_purge_removes_selected_members_and_every_related_record(self):
        # Given
        password_user = User.objects.create_user(
            username="password-target",
            nickname="일반로그인대상",
            email="password@example.com",
            password="password-pass-123",
            has_usable_password_flag=True,
        )
        social_user = User.objects.create_user(
            username="social-target",
            nickname="소셜로그인대상",
            email="social@example.com",
        )
        SocialAccount.objects.create(
            user=social_user,
            provider="kakao",
            provider_id="purge-kakao-id",
            email="social@example.com",
        )
        merged_account = User.objects.create_user(
            username="merged-target",
            nickname="병합계정대상",
            is_active=False,
            merged_into=social_user,
        )
        reading_record = PersonalReadingRecord.objects.create(
            user=password_user,
            book="gen",
            chapter=1,
            read_date=date.today(),
        )
        owned_plan = BibleReadingPlan.objects.create(
            name="삭제할 사용자 플랜",
            created_by=social_user,
        )
        sent_notification = Notification.objects.create(
            recipient=self.admin,
            actor=password_user,
            type="friend_activity",
            title="삭제할 알림",
            body="삭제할 사용자가 만든 알림",
        )
        refresh_token = RefreshToken.for_user(password_user)
        refresh_token.blacklist()
        outstanding_token = OutstandingToken.objects.get(
            jti=refresh_token["jti"],
        )
        blacklisted_token = outstanding_token.blacklistedtoken

        # When
        response = self.client.post(
            self.url,
            self._selection_payload(
                password_user,
                social_user,
                confirmed=True,
            ),
            follow=True,
        )

        # Then
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            User.objects.filter(
                pk__in=[password_user.pk, social_user.pk, merged_account.pk],
            ).exists()
        )
        self.assertFalse(SocialAccount.objects.filter(user=social_user).exists())
        self.assertFalse(
            PersonalReadingRecord.objects.filter(pk=reading_record.pk).exists()
        )
        self.assertFalse(BibleReadingPlan.objects.filter(pk=owned_plan.pk).exists())
        self.assertFalse(Notification.objects.filter(pk=sent_notification.pk).exists())
        self.assertFalse(
            OutstandingToken.objects.filter(pk=outstanding_token.pk).exists()
        )
        self.assertFalse(
            BlacklistedToken.objects.filter(pk=blacklisted_token.pk).exists()
        )
        self.assertContains(response, "회원 3명과 연관 데이터를 영구 삭제했습니다.")

    def test_purge_aborts_entire_selection_when_privileged_member_is_included(self):
        # Given
        regular_user = User.objects.create_user(
            username="regular-target",
            nickname="일반삭제대상",
        )

        # When
        response = self.client.post(
            self.url,
            self._selection_payload(
                regular_user,
                self.admin,
                confirmed=True,
            ),
            follow=True,
        )

        # Then
        self.assertTrue(User.objects.filter(pk=regular_user.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())
        messages = [str(message) for message in get_messages(response.wsgi_request)]
        self.assertIn(
            "현재 관리자 또는 권한 계정은 영구 삭제할 수 없습니다.",
            messages,
        )

    def test_purge_rejects_non_staff_superuser_account(self):
        # Given
        regular_user = User.objects.create_user(
            username="regular-with-special-account",
            nickname="일반선택회원",
        )
        non_staff_superuser = User.objects.create_user(
            username="non-staff-superuser",
            nickname="비직원슈퍼유저",
            is_staff=False,
            is_superuser=True,
        )

        # When
        response = self.client.post(
            self.url,
            self._selection_payload(
                regular_user,
                non_staff_superuser,
                confirmed=True,
            ),
            follow=True,
        )

        # Then
        self.assertTrue(User.objects.filter(pk=regular_user.pk).exists())
        self.assertTrue(User.objects.filter(pk=non_staff_superuser.pk).exists())

    def test_confirmation_exposes_merged_accounts_and_shared_plan_impact(self):
        # Given
        target = User.objects.create_user(
            username="impact-target",
            nickname="영향확인대상",
        )
        merged_account = User.objects.create_user(
            username="impact-merged",
            nickname="병합포함계정",
            merged_into=target,
            is_active=False,
        )
        shared_plan = BibleReadingPlan.objects.create(
            name="다른 회원이 구독한 플랜",
            created_by=target,
        )
        PlanSubscription.objects.create(
            user=self.admin,
            plan=shared_plan,
            start_date=date.today(),
        )

        # When
        response = self.client.post(
            self.url,
            self._selection_payload(target),
        )

        # Then
        self.assertEqual(
            list(response.context["selected_users"].values_list("pk", flat=True)),
            [target.pk],
        )
        self.assertEqual(
            list(response.context["merged_users"].values_list("pk", flat=True)),
            [merged_account.pk],
        )
        self.assertEqual(response.context["shared_plan_subscription_count"], 1)
