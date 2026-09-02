from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase, override_settings
from django.urls import reverse

from accounts.models import SocialAccount

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class MemberListAdminTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="member-list-admin",
            nickname="회원목록관리자",
            email="list-admin@example.com",
            password="admin-pass-123",
        )
        self.client.force_login(self.admin)
        self.url = reverse("admin:accounts_user_changelist")

    def test_non_superuser_cannot_see_member_purge_action(self):
        # Given
        staff = User.objects.create_user(
            username="limited-staff",
            nickname="제한관리자",
            password="staff-pass-123",
            is_staff=True,
        )
        staff.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="accounts",
                codename="view_user",
            ),
            Permission.objects.get(
                content_type__app_label="accounts",
                codename="change_user",
            ),
            Permission.objects.get(
                content_type__app_label="accounts",
                codename="delete_user",
            ),
        )
        self.client.force_login(staff)

        # When
        response = self.client.get(self.url)

        # Then
        self.assertIsNone(response.context["action_form"])

    def test_member_list_shows_login_methods_and_recent_activity(self):
        # Given
        target = User.objects.create_user(
            username="visible-target",
            nickname="표시대상",
            email="visible@example.com",
            password="visible-pass-123",
            has_usable_password_flag=True,
        )
        SocialAccount.objects.create(
            user=target,
            provider="google",
            provider_id="visible-google-id",
        )

        # When
        response = self.client.get(self.url)

        # Then
        self.assertContains(response, "로그인 수단")
        self.assertContains(response, "최근 로그인")
        self.assertContains(response, "표시대상")
        self.assertContains(response, "일반")
        self.assertContains(response, "구글")
