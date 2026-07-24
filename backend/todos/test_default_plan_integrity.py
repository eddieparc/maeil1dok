"""Data-integrity tests for the single-default BibleReadingPlan invariant.

Guarantees enforced here:
- At most one BibleReadingPlan row may have is_default=True (DB-level, via the
  unique generated column default_plan_identity).
- Every API write path that sets is_default=True (create / update / set_default)
  converges to exactly one default.
- Plan mutation endpoints stay staff-only.
"""
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan


User = get_user_model()


@override_settings(ROOT_URLCONF="config.urls")
class DefaultPlanIntegrityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin', nickname='관리자', password='pass',
            is_staff=True, is_superuser=True,
        )
        self.member = User.objects.create_user(
            username='member', nickname='일반', password='pass',
        )
        self.existing_default = BibleReadingPlan.objects.create(
            name='Original Default', description='d', is_active=True,
            is_default=True, created_by=self.admin,
        )

    def _default_count(self):
        return BibleReadingPlan.objects.filter(is_default=True).count()

    def test_second_default_raises_integrity_error_at_db_level(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                BibleReadingPlan.objects.create(
                    name='Second Default', description='d', is_active=True,
                    is_default=True, created_by=self.admin,
                )
        self.assertEqual(self._default_count(), 1)

    def test_create_with_default_clears_previous_default(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            '/api/v1/todos/bible-plans/',
            {'name': 'New Default', 'description': 'd', 'is_default': True},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(self._default_count(), 1)
        self.existing_default.refresh_from_db()
        self.assertFalse(self.existing_default.is_default)
        self.assertTrue(
            BibleReadingPlan.objects.get(name='New Default').is_default
        )

    def test_patch_with_default_clears_previous_default(self):
        other = BibleReadingPlan.objects.create(
            name='Not Default Yet', description='d', is_active=True,
            is_default=False, created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/v1/todos/bible-plans/{other.id}/',
            {'is_default': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self._default_count(), 1)
        other.refresh_from_db()
        self.existing_default.refresh_from_db()
        self.assertTrue(other.is_default)
        self.assertFalse(self.existing_default.is_default)

    def test_set_default_action_leaves_single_default(self):
        target = BibleReadingPlan.objects.create(
            name='Target', description='d', is_active=True,
            is_default=False, created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/v1/todos/bible-plans/{target.id}/set_default/'
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            response.json()['detail'], '기본 플랜으로 설정되었습니다.'
        )
        self.assertEqual(self._default_count(), 1)
        target.refresh_from_db()
        self.existing_default.refresh_from_db()
        self.assertTrue(target.is_default)
        self.assertFalse(self.existing_default.is_default)

    def test_set_default_missing_plan_returns_404_and_keeps_default(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            '/api/v1/todos/bible-plans/999999/set_default/'
        )
        self.assertEqual(response.status_code, 404)
        self.existing_default.refresh_from_db()
        self.assertTrue(self.existing_default.is_default)
        self.assertEqual(self._default_count(), 1)

    def test_non_staff_forbidden_on_all_write_paths(self):
        self.client.force_authenticate(user=self.member)

        create = self.client.post(
            '/api/v1/todos/bible-plans/',
            {'name': 'Blocked', 'description': 'd', 'is_default': True},
            format='json',
        )
        self.assertEqual(create.status_code, 403)

        patch = self.client.patch(
            f'/api/v1/todos/bible-plans/{self.existing_default.id}/',
            {'is_default': True},
            format='json',
        )
        self.assertEqual(patch.status_code, 403)

        set_default = self.client.post(
            f'/api/v1/todos/bible-plans/{self.existing_default.id}/set_default/'
        )
        self.assertEqual(set_default.status_code, 403)

        # No plans were created and the original default is intact.
        self.assertFalse(BibleReadingPlan.objects.filter(name='Blocked').exists())
        self.assertEqual(self._default_count(), 1)
