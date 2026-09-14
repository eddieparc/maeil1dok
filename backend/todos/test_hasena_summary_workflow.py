from datetime import date, datetime
from unittest.mock import Mock, patch

import requests
from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from todos.models import HasenaSummary
from todos.services.hasena_summary_service import get_hasena_summary


BASE = '/api/v1/todos/hasena/'
SERVICE = 'todos.services.hasena_summary_service'
SECRET = 'provider-secret prompt-content bearer-token'


@override_settings(GEMINI_API_KEY='fixture-key')
class HasenaSummaryWorkflowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.staff = User.objects.create_user(username='hasena-staff', nickname='Staff', is_staff=True)
        cls.member = User.objects.create_user(username='hasena-member', nickname='Member')

    def setUp(self):
        self.client = APIClient()
        self.authenticate(self.staff)
        # Only external transports are replaced. HTTP routing, auth, services and DB are real.
        self.transcript = self.enterContext(patch(
            'youtube_transcript_api.YouTubeTranscriptApi.fetch',
            return_value=[Mock(text='fixture transcript')],
        ))
        self.provider = self.enterContext(patch('google.genai.Client'))
        self.generate = self.provider.return_value.models.generate_content
        self.generate.return_value = Mock(text='Generated summary')
        self.enterContext(patch(f'{SERVICE}.requests.get', side_effect=AssertionError('unexpected HTTP')))

    def authenticate(self, user):
        token = AccessToken.for_user(user)
        token['token_version'] = user.token_version
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

    def create_summary(self, video_id='existing', **kwargs):
        return HasenaSummary.objects.create(
            video_id=video_id, summary='Last valid summary', title='Known title',
            video_date=date(2026, 9, 1), **kwargs,
        )

    def regenerate(self, video_id):
        return self.client.post(BASE + 'summaries/regenerate/', {'video_id': video_id}, format='json')

    def rows(self, **params):
        response = self.client.get(BASE + 'summaries/', params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.json()

    def failure(self, video_id):
        return apps.get_model('todos', 'HasenaSummaryFailure').objects.get(video_id=video_id)

    def test_save_reviews_and_blank_title_clears_then_regeneration_requires_review(self):
        summary = self.create_summary()
        saved = self.client.put(BASE + 'summaries/existing/', {
            'summary': 'Reviewed summary', 'title': '',
        }, format='json')
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data['status'], 'reviewed')
        summary.refresh_from_db()
        self.assertEqual(summary.title, '')
        self.assertTrue(summary.is_edited)
        regenerated = self.regenerate('existing')
        self.assertEqual(regenerated.status_code, 200)
        self.assertEqual(regenerated.data['status'], 'review_needed')
        summary.refresh_from_db()
        self.assertFalse(summary.is_edited)
        self.assertEqual(summary.summary, 'Generated summary')
        self.assertEqual(summary.video_date, date(2026, 9, 1))
        self.assertEqual(summary.title, '')

    def test_transport_failure_without_summary_is_persisted_but_not_public_success(self):
        self.generate.side_effect = requests.ConnectionError(SECRET)
        with self.assertLogs(SERVICE, level='ERROR') as logs:
            response = self.regenerate('never-generated')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['status'], 'failed')
        self.assertTrue(response.data['failure_persisted'])
        self.assertEqual(response.data['error_code'], 'generation_failed')
        self.assertNotIn(SECRET, repr(response.data) + repr(logs.output))
        self.assertFalse(HasenaSummary.objects.filter(video_id='never-generated').exists())
        failure = self.failure('never-generated')
        self.assertIsNone(failure.video_date)
        self.assertEqual(failure.title, '')
        row = self.rows(status='failed')['summaries'][0]
        self.assertEqual(row['status'], 'failed')
        self.assertFalse(row['has_summary'])
        for key in ('id', 'summary_preview', 'is_edited', 'model_used'):
            self.assertIsNone(row[key])
        detail = self.client.get(BASE + 'summary/', {'video_id': 'never-generated'})
        self.assertEqual(detail.status_code, 404)
        self.assertEqual(detail.data['status'], 'failed')
        self.client.credentials()
        public = self.client.get(BASE + 'summary/', {'video_id': 'never-generated'})
        self.assertEqual(public.status_code, 404)
        self.assertFalse(public.data['success'])
        self.assertNotIn('status', public.data)
        self.assertNotIn('error_code', public.data)

    def test_failure_preserves_last_valid_summary_and_save_clears_failure(self):
        summary = self.create_summary(is_edited=True)
        self.generate.side_effect = requests.ConnectionError(SECRET)
        self.assertEqual(self.regenerate(summary.video_id).status_code, 400)
        summary.refresh_from_db()
        self.assertEqual(summary.summary, 'Last valid summary')
        self.assertTrue(summary.is_edited)
        self.assertEqual(self.rows()['summaries'][0]['status'], 'failed')
        detail = self.client.get(BASE + 'summary/', {'video_id': summary.video_id})
        self.assertEqual(detail.data['status'], 'failed')
        self.assertEqual(detail.data['summary'], 'Last valid summary')
        self.client.credentials()
        public = self.client.get(BASE + 'summary/', {'video_id': summary.video_id})
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data['summary'], 'Last valid summary')
        self.assertNotIn('error_code', public.data)
        self.authenticate(self.staff)
        saved = self.client.put(BASE + 'summaries/existing/', {'summary': 'Accepted last summary'}, format='json')
        self.assertEqual(saved.data['status'], 'reviewed')
        self.assertEqual(saved.data['title'], 'Known title')
        self.assertEqual(self.rows(status='failed')['total'], 0)

    def test_retry_success_clears_failure_and_preserves_known_failure_metadata(self):
        self.generate.side_effect = requests.ConnectionError(SECRET)
        result = get_hasena_summary('cron-failure', video_date=date(2026, 9, 2), title='Actual video title')
        self.assertFalse(result['success'])
        self.assertTrue(result['failure_persisted'])
        self.assertEqual(self.failure('cron-failure').title, 'Actual video title')
        self.generate.side_effect = None
        response = self.regenerate('cron-failure')
        self.assertEqual(response.status_code, 200)
        summary = HasenaSummary.objects.get(video_id='cron-failure')
        self.assertEqual(summary.title, 'Actual video title')
        self.assertEqual(summary.video_date, date(2026, 9, 2))
        self.assertEqual(self.rows(status='failed')['total'], 0)
        self.assertEqual(self.rows(status='review_needed')['total'], 1)

    def test_filter_counts_before_pagination_deduplicates_and_orders_ties(self):
        for video_id in ('review-a', 'review-b', 'review-c'):
            self.create_summary(video_id)
        self.create_summary('saved', is_edited=True)
        self.create_summary('failed-existing', is_edited=True)
        self.generate.side_effect = requests.ConnectionError(SECRET)
        self.regenerate('failed-existing')
        self.regenerate('failed-only')
        self.regenerate('failed-only')
        HasenaSummary.objects.update(created_at=datetime(2026, 9, 1, 12))
        self.assertEqual(self.rows()['total'], 6)
        self.assertEqual(
            [row['video_id'] for row in self.rows(status='review_needed')['summaries']],
            ['review-a', 'review-b', 'review-c'],
        )
        for status, total in [('review_needed', 3), ('failed', 2), ('all', 6)]:
            seen = []
            for page in range(1, total + 1):
                data = self.rows(status=status, page=page, page_size=1)
                self.assertEqual(data['total'], total)
                seen.append(data['summaries'][0]['video_id'])
            self.assertEqual(len(set(seen)), total)
            self.assertEqual(self.rows(status=status, page=total + 1, page_size=1)['summaries'], [])
        model = apps.get_model('todos', 'HasenaSummaryFailure')
        with self.assertRaises(IntegrityError), transaction.atomic():
            model.objects.create(video_id='failed-only', error_code='generation_failed')
        with self.assertRaises(IntegrityError), transaction.atomic():
            model.objects.create(video_id='invalid-code', error_code='raw-provider-error')

    def test_transcript_failure_and_quota_are_safe_persisted_codes(self):
        self.transcript.side_effect = requests.ConnectionError(SECRET)
        response = self.regenerate('no-transcript')
        self.assertEqual(response.data['error_code'], 'transcript_unavailable')
        self.assertEqual(self.failure('no-transcript').error_code, 'transcript_unavailable')
        self.generate.assert_not_called()
        self.transcript.side_effect = None
        self.generate.side_effect = requests.HTTPError('429 RESOURCE_EXHAUSTED ' + SECRET)
        response = self.regenerate('quota')
        self.assertEqual(response.data['error_code'], 'quota_exceeded')
        self.assertEqual(response.data['retry_after'], 60)
        self.assertEqual(self.failure('quota').error_code, 'quota_exceeded')
        self.assertNotIn(SECRET, repr(response.data))

    def test_empty_provider_output_cannot_replace_valid_summary(self):
        summary = self.create_summary()
        self.generate.return_value = Mock(text='   ')
        response = self.regenerate(summary.video_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error_code'], 'generation_failed')
        summary.refresh_from_db()
        self.assertEqual(summary.summary, 'Last valid summary')

    def test_failed_summary_write_rolls_back_and_records_safe_storage_failure(self):
        summary = self.create_summary()
        with patch.object(HasenaSummary, 'save', side_effect=IntegrityError(SECRET)):
            response = self.regenerate(summary.video_id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error_code'], 'storage_failed')
        self.assertTrue(response.data['failure_persisted'])
        summary.refresh_from_db()
        self.assertEqual(summary.summary, 'Last valid summary')
        self.assertEqual(self.failure(summary.video_id).error_code, 'storage_failed')
        self.assertNotIn(SECRET, repr(response.data))

    def test_failed_failure_write_does_not_claim_persisted_state(self):
        model = apps.get_model('todos', 'HasenaSummaryFailure')
        self.generate.side_effect = requests.ConnectionError(SECRET)
        with patch.object(model, 'save', side_effect=IntegrityError(SECRET)):
            response = self.regenerate('db-unavailable')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data['failure_persisted'])
        self.assertNotIn('status', response.data)
        self.assertFalse(response.data['persisted'])
        self.assertFalse(response.data['cacheable'])
        self.assertFalse(model.objects.filter(video_id='db-unavailable').exists())
        self.assertNotIn(SECRET, repr(response.data))

    def test_review_and_regeneration_roll_back_if_failure_clear_cannot_commit(self):
        summary = self.create_summary()
        self.generate.side_effect = requests.ConnectionError(SECRET)
        self.regenerate(summary.video_id)
        self.generate.side_effect = None
        # The failure deletion is in the same transaction as both summary writes.
        with patch('django.db.models.query.QuerySet.delete', side_effect=IntegrityError(SECRET)):
            saved = self.client.put(BASE + 'summaries/existing/', {'summary': 'Not committed'}, format='json')
            self.assertEqual(saved.status_code, 500)
            regenerated = self.regenerate(summary.video_id)
            self.assertEqual(regenerated.status_code, 400)
        summary.refresh_from_db()
        self.assertEqual(summary.summary, 'Last valid summary')
        self.assertFalse(summary.is_edited)
        self.assertEqual(self.rows(status='failed')['total'], 1)

    @override_settings(CRON_SECRET='fixture-cron')
    def test_cron_video_transport_failure_persists_real_metadata_then_success_clears_it(self):
        self.transcript.side_effect = requests.ConnectionError(SECRET)
        self.generate.side_effect = requests.ConnectionError(SECRET)
        body = {'video_id': 'cron-video', 'video_date': '2026-09-03', 'title': 'Actual cron title'}
        response = self.client.post(BASE + 'summary/cron/', body, format='json', HTTP_X_CRON_SECRET='fixture-cron')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data['failure_persisted'])
        self.assertFalse(HasenaSummary.objects.filter(video_id='cron-video').exists())
        failure = self.failure('cron-video')
        self.assertEqual(failure.video_date, date(2026, 9, 3))
        self.assertEqual(failure.title, 'Actual cron title')
        self.generate.side_effect = None
        response = self.client.post(BASE + 'summary/cron/', body, format='json', HTTP_X_CRON_SECRET='fixture-cron')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['persisted'])
        self.assertTrue(response.data['cacheable'])
        self.assertEqual(self.rows(status='failed')['total'], 0)

    def test_existing_cached_read_does_not_clear_a_failed_regeneration(self):
        self.create_summary(is_edited=True)
        self.generate.side_effect = requests.ConnectionError(SECRET)
        self.regenerate('existing')
        self.generate.reset_mock()
        result = get_hasena_summary('existing')
        self.assertEqual(result['summary'], 'Last valid summary')
        self.assertTrue(result['is_edited'])
        self.generate.assert_not_called()
        self.assertEqual(self.rows(status='failed')['total'], 1)

    def test_maximum_field_lengths_and_null_title_are_compatible(self):
        video_id = 'a' * 20
        self.assertEqual(self.regenerate(video_id).status_code, 200)
        response = self.client.put(BASE + f'summaries/{video_id}/', {'summary': 'Reviewed', 'title': 't' * 200}, format='json')
        self.assertEqual(response.status_code, 200)
        response = self.client.put(BASE + f'summaries/{video_id}/', {'summary': 'Reviewed again', 'title': None}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 't' * 200)

    def test_requests_validate_before_transport_or_write(self):
        self.create_summary()
        for params in ({'status': 'reviewed'}, {'status': ''}, {'page': '0'}, {'page_size': 101}):
            self.assertEqual(self.client.get(BASE + 'summaries/', params).status_code, 400)
        for value in ('x' * 21, {}, 42, ''):
            self.assertEqual(self.regenerate(value).status_code, 400)
        for body in ({'summary': []}, {'summary': 'ok', 'title': 'x' * 201}):
            self.assertEqual(self.client.put(BASE + 'summaries/existing/', body, format='json').status_code, 400)
        self.generate.assert_not_called()
        self.transcript.assert_not_called()

    def test_staff_gate_and_failure_only_cannot_be_saved_as_a_summary(self):
        self.generate.side_effect = requests.ConnectionError(SECRET)
        self.regenerate('failure-only')
        self.assertEqual(self.client.put(BASE + 'summaries/failure-only/', {'summary': 'Invented'}, format='json').status_code, 404)
        self.assertEqual(self.rows(status='failed')['total'], 1)
        self.generate.reset_mock()
        for user, expected in ((self.member, 403), (None, 401)):
            if user:
                self.authenticate(user)
            else:
                self.client.credentials()
            self.assertEqual(self.client.get(BASE + 'summaries/').status_code, expected)
            self.assertEqual(self.regenerate('failure-only').status_code, expected)
            self.assertEqual(self.client.put(BASE + 'summaries/failure-only/', {'summary': 'no'}, format='json').status_code, expected)
        self.generate.assert_not_called()
