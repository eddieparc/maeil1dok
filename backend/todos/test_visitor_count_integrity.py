from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from todos.models import VisitorCount


class VisitorCountIntegrityTests(TestCase):
    def test_first_visit_creates_counter_and_counts_once(self):
        visitor_count = VisitorCount.increment_daily_count()

        self.assertEqual(visitor_count.date, timezone.now().date())
        self.assertEqual(visitor_count.daily_count, 1)
        self.assertEqual(VisitorCount.objects.count(), 1)

    def test_existing_daily_counter_increments_atomically(self):
        VisitorCount.objects.create(date=timezone.now().date(), daily_count=1)

        visitor_count = VisitorCount.increment_daily_count()

        self.assertEqual(visitor_count.daily_count, 2)
        self.assertEqual(VisitorCount.objects.count(), 1)

    def test_duplicate_create_race_retries_existing_counter_increment(self):
        existing = VisitorCount.objects.create(date=timezone.now().date(), daily_count=1)

        with patch.object(
            VisitorCount.objects,
            'get_or_create',
            side_effect=[
                IntegrityError('duplicate date'),
                (existing, False),
            ],
        ) as get_or_create:
            visitor_count = VisitorCount.increment_daily_count()

        self.assertEqual(get_or_create.call_count, 2)
        self.assertEqual(visitor_count.daily_count, 2)
        self.assertEqual(VisitorCount.objects.get(pk=existing.pk).daily_count, 2)
        self.assertEqual(VisitorCount.objects.count(), 1)
