"""
Regression tests for GET query-param validation on the Hasena endpoints.

Locks the input-validation/boundary contract closed this cycle:

Record list — GET /api/v1/todos/hasena/
  - malformed `year`/`month` and out-of-range values return structured 400s
    instead of being fed raw into ORM date lookups;
  - independent optionality of `year`/`month` is preserved;
  - valid `year`+`month` still filters correctly and keeps the bare-list shape.

Summaries — GET /api/v1/todos/hasena/summaries/ (staff only)
  - malformed/out-of-range `page`/`page_size` return structured 400s before
    the service is called, so a client can never surface raw exception strings
    (e.g. "Negative indexing is not supported") inside a 200 response;
  - `page_size` is capped at 100;
  - the valid staff path and non-staff 403 are unchanged.
"""
from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from todos.models import HasenaRecord


User = get_user_model()
HASENA_URL = '/api/v1/todos/hasena/'
SUMMARIES_URL = '/api/v1/todos/hasena/summaries/'


# LocMem cache + throttling disabled so the suite does not depend on Redis,
# matching the pattern used across the other Hasena test modules.
_TEST_CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'hasena-query-validation-test-cache',
    },
}
_TEST_REST_FRAMEWORK = {
    **settings.REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {},
}


@override_settings(CACHES=_TEST_CACHES, REST_FRAMEWORK=_TEST_REST_FRAMEWORK)
class HasenaRecordListQueryValidationTestCase(TestCase):
    """Validation of GET /api/v1/todos/hasena/ `year`/`month` filters."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='hasenaquery',
            password='hasenapass123',
            nickname='Hasena Query',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.july_record = HasenaRecord.objects.create(
            user=self.user, date=date(2026, 7, 6), is_completed=True,
        )
        self.june_record = HasenaRecord.objects.create(
            user=self.user, date=date(2026, 6, 6), is_completed=True,
        )

    def test_non_numeric_year_returns_400(self):
        response = self.client.get(HASENA_URL, {'year': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_out_of_range_month_returns_400(self):
        response = self.client.get(HASENA_URL, {'month': '13'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_zero_year_returns_400(self):
        response = self.client.get(HASENA_URL, {'year': '0', 'month': '7'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_fractional_year_returns_400(self):
        response = self.client.get(HASENA_URL, {'year': '2026.5'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_valid_year_month_filters_correctly(self):
        response = self.client.get(HASENA_URL, {'year': '2026', 'month': '7'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row['id'] for row in response.data]
        self.assertIn(self.july_record.id, ids)
        self.assertNotIn(self.june_record.id, ids)
        # Preserves the bare-list response shape.
        row = response.data[0]
        self.assertEqual(
            set(row.keys()), {'id', 'date', 'is_completed', 'created_at'},
        )

    def test_no_params_returns_all_records(self):
        response = self.client.get(HASENA_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row['id'] for row in response.data}
        self.assertEqual(ids, {self.july_record.id, self.june_record.id})

    def test_year_alone_preserves_optionality(self):
        response = self.client.get(HASENA_URL, {'year': '2026'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row['id'] for row in response.data}
        self.assertEqual(ids, {self.july_record.id, self.june_record.id})


@override_settings(CACHES=_TEST_CACHES, REST_FRAMEWORK=_TEST_REST_FRAMEWORK)
class HasenaSummariesPaginationValidationTestCase(TestCase):
    """Validation of GET /api/v1/todos/hasena/summaries/ pagination params."""

    def setUp(self):
        self.staff = User.objects.create_user(
            username='hasenastaff',
            password='hasenapass123',
            nickname='Hasena Staff',
            is_staff=True,
        )
        self.non_staff = User.objects.create_user(
            username='hasenauser',
            password='hasenapass123',
            nickname='Hasena User',
        )
        self.client = APIClient()

    def _staff_get(self, params=None):
        self.client.force_authenticate(user=self.staff)
        return self.client.get(SUMMARIES_URL, params or {})

    def test_non_numeric_page_returns_400(self):
        response = self._staff_get({'page': 'abc'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_zero_page_returns_400_without_leaking_exception(self):
        response = self._staff_get({'page': '0'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn(
            'Negative indexing is not supported', str(response.data),
        )

    def test_zero_page_size_returns_400(self):
        response = self._staff_get({'page_size': '0'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_page_size_over_cap_returns_400(self):
        response = self._staff_get({'page_size': '101'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_valid_pagination_returns_200(self):
        response = self._staff_get({'page': '1', 'page_size': '20'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    def test_non_staff_returns_403(self):
        self.client.force_authenticate(user=self.non_staff)
        response = self.client.get(SUMMARIES_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
