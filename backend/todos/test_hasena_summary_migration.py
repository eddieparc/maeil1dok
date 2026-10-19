from datetime import date

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class HasenaSummaryFailureMigrationTests(TransactionTestCase):
    def test_upgrade_and_rollback_preserve_existing_summary_and_review_authority(self):
        before = [('todos', '0033_notification_settings_absorb_legacy')]
        after = [('todos', '0034_hasena_summary_failure')]
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        try:
            executor.migrate(before)
            old_apps = executor.loader.project_state(before).apps
            Summary = old_apps.get_model('todos', 'HasenaSummary')
            for reviewed in (False, True):
                Summary.objects.create(
                    video_id=f'legacy-{reviewed}', video_date=date(2026, 8, 1),
                    title='Existing title', summary='Existing summary', transcript='Existing transcript',
                    model_used='existing-model', is_edited=reviewed,
                )
            expected = list(Summary.objects.order_by('video_id').values())
            executor = MigrationExecutor(connection)
            executor.migrate(after)
            new_apps = executor.loader.project_state(after).apps
            Failure = new_apps.get_model('todos', 'HasenaSummaryFailure')
            self.assertEqual(Failure.objects.count(), 0)
            self.assertEqual(list(new_apps.get_model('todos', 'HasenaSummary').objects.order_by('video_id').values()), expected)
            Failure.objects.create(video_id='no-prior-summary', error_code='generation_failed')
            from todos.services.hasena_summary_service import get_existing_summary, list_summaries
            statuses = {row['video_id']: row['status'] for row in list_summaries()['summaries']}
            self.assertEqual(statuses, {
                'legacy-False': 'review_needed', 'legacy-True': 'reviewed', 'no-prior-summary': 'failed',
            })
            self.assertFalse(get_existing_summary('no-prior-summary')['success'])
            executor = MigrationExecutor(connection)
            executor.migrate(before)
            self.assertEqual(list(Summary.objects.order_by('video_id').values()), expected)
            self.assertNotIn('todos_hasenasummaryfailure', connection.introspection.table_names())
        finally:
            MigrationExecutor(connection).migrate(latest)
