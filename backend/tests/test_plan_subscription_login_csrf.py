from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan


User = get_user_model()


class PlanSubscriptionLoginCsrfTests(TestCase):
    def test_email_login_issues_csrf_token_that_authorizes_subscription_post(self):
        user = User.objects.create_user(
            username='plan-reader',
            password='testpass123',
            nickname='Plan Reader',
        )
        plan = BibleReadingPlan.objects.create(
            name='Subscription Plan',
            description='CSRF contract plan',
            is_active=True,
            created_by=user,
        )
        client = APIClient(enforce_csrf_checks=True)

        login_response = client.post(
            '/api/v1/auth/email-login/',
            {'email': user.username, 'password': 'testpass123'},
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn('X-CSRFToken', login_response)
        csrf_token = login_response['X-CSRFToken']
        self.assertTrue(csrf_token)
        self.assertIn('csrftoken', login_response.cookies)

        subscription_response = client.post(
            '/api/v1/todos/plan/',
            {'plan': plan.pk},
            format='json',
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(subscription_response.status_code, status.HTTP_201_CREATED)

