from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.urls import reverse

User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class AdminCsrfRecoveryTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="csrf-admin",
            nickname="CSRF관리자",
            email="csrf-admin@example.com",
            password="csrf-admin-pass-123",
        )
        self.client = Client(enforce_csrf_checks=True)
        self.login_url = reverse("admin:login")

    def test_duplicate_login_post_redirects_after_first_post_authenticated(self):
        # Given
        login_page = self.client.get(self.login_url, secure=True)
        original_form_token = str(login_page.context["csrf_token"])
        credentials = {
            "csrfmiddlewaretoken": original_form_token,
            "username": self.admin.username,
            "password": "csrf-admin-pass-123",
            "next": reverse("admin:index"),
        }
        request_headers = {
            "secure": True,
            "HTTP_ORIGIN": "https://api.maeil1dok.app",
            "HTTP_REFERER": "https://api.maeil1dok.app/admin/login/",
        }
        first_response = self.client.post(
            self.login_url,
            credentials,
            **request_headers,
        )
        self.assertEqual(first_response.status_code, 302)

        # When
        duplicate_response = self.client.post(
            self.login_url,
            credentials,
            **request_headers,
        )

        # Then
        self.assertRedirects(
            duplicate_response,
            reverse("admin:index"),
            fetch_redirect_response=False,
        )

    def test_anonymous_invalid_csrf_token_remains_forbidden(self):
        # Given
        client = Client(enforce_csrf_checks=True)
        client.get(self.login_url, secure=True)

        # When
        response = client.post(
            self.login_url,
            {
                "csrfmiddlewaretoken": "invalid-token",
                "username": self.admin.username,
                "password": "csrf-admin-pass-123",
            },
            secure=True,
            HTTP_ORIGIN="https://api.maeil1dok.app",
            HTTP_REFERER="https://api.maeil1dok.app/admin/login/",
        )

        # Then
        self.assertEqual(response.status_code, 403)
