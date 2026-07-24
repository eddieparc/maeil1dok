"""
Unit tests for the pure catch-up scheduling algorithm
(`todos.services.catchup.calculate_catchup_schedule`).

These lock in two data-integrity / correctness invariants that were violated
before cycle-111 hardening:

  1. No overdue reading is ever silently dropped: a single reading whose chapter
     span exceeds ``max_daily_chapters`` must still be scheduled (placed alone on
     a day) instead of vanishing into the ignored ``remaining`` list.
  2. The weekend multiplier must never *disable* a per-day cap: a multiplier < 1
     that floors the adjusted limit to 0 previously turned the cap off entirely,
     dumping the whole backlog onto one weekend day.
"""

from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase

from todos.services.catchup import calculate_catchup_schedule


def _schedule(idx, start_chapter, end_chapter):
    """Lightweight stand-in; the scheduler only reads chapter fields."""
    return SimpleNamespace(id=idx, start_chapter=start_chapter, end_chapter=end_chapter)


class CalculateCatchupScheduleTest(SimpleTestCase):
    # Jan 3 2026 is a Saturday, Jan 4 a Sunday, Jan 5 a Monday.
    SATURDAY = date(2026, 1, 3)
    # Jan 5 2026 is a Monday (weekday).
    MONDAY = date(2026, 1, 5)

    def _placed_ids(self, distributed):
        return [item.id for day in distributed for item in day["items"]]

    def test_oversized_reading_is_scheduled_not_silently_dropped(self):
        """A reading larger than the daily chapter cap must still be placed."""
        oversized = _schedule(1, start_chapter=1, end_chapter=5)  # 5 chapters
        distributed, remaining = calculate_catchup_schedule(
            [oversized],
            start_date=self.MONDAY,
            target_date=None,
            max_daily_readings=None,
            max_daily_chapters=2,  # smaller than the reading itself
            weekend_multiplier=1.0,
        )

        self.assertEqual(remaining, [], "oversized reading must not be dropped")
        self.assertEqual(self._placed_ids(distributed), [1])
        # Placed alone on a single day.
        self.assertEqual(len(distributed), 1)
        self.assertEqual(distributed[0]["total_chapters"], 5)

    def test_every_reading_scheduled_when_no_target_date(self):
        """With no target date, all in-range readings are scheduled (no drop)."""
        schedules = [
            _schedule(1, 1, 4),   # 4 chapters (> cap of 2)
            _schedule(2, 5, 5),   # 1 chapter
            _schedule(3, 6, 9),   # 4 chapters (> cap of 2)
        ]
        distributed, remaining = calculate_catchup_schedule(
            schedules,
            start_date=self.MONDAY,
            target_date=None,
            max_daily_readings=None,
            max_daily_chapters=2,
            weekend_multiplier=1.0,
        )

        self.assertEqual(remaining, [])
        self.assertCountEqual(self._placed_ids(distributed), [1, 2, 3])

    def test_weekend_multiplier_below_one_does_not_disable_reading_cap(self):
        """max_daily_readings=1 + weekend_multiplier=0.5 must not dump backlog."""
        schedules = [_schedule(i, i, i) for i in range(1, 4)]  # 3 one-chapter reads
        distributed, remaining = calculate_catchup_schedule(
            schedules,
            start_date=self.SATURDAY,  # day 1 = Sat, day 2 = Sun, day 3 = Mon
            target_date=None,
            max_daily_readings=1,
            max_daily_chapters=None,
            weekend_multiplier=0.5,  # floors int(1*0.5) -> 0
        )

        self.assertEqual(remaining, [])
        # Each day carries at most one reading; the first (weekend) day is NOT
        # allowed to absorb all three.
        for day in distributed:
            self.assertLessEqual(
                len(day["items"]), 1,
                "weekend day must still honour the max_daily_readings cap",
            )
        self.assertEqual(len(distributed), 3)

    def test_weekend_chapter_limit_below_one_still_makes_progress(self):
        """A weekend chapter cap flooring to 0 must not starve the whole day."""
        schedules = [_schedule(i, i, i) for i in range(1, 4)]  # one-chapter reads
        distributed, remaining = calculate_catchup_schedule(
            schedules,
            start_date=self.SATURDAY,
            target_date=None,
            max_daily_readings=None,
            max_daily_chapters=1,
            weekend_multiplier=0.5,  # floors int(1*0.5) -> 0
        )

        self.assertEqual(remaining, [])
        self.assertCountEqual(self._placed_ids(distributed), [1, 2, 3])

    def test_weekday_caps_are_still_enforced(self):
        """Positive regression: normal weekday capping behaviour is unchanged."""
        schedules = [_schedule(i, 1, 2) for i in range(1, 6)]  # five 2-chapter reads
        distributed, remaining = calculate_catchup_schedule(
            schedules,
            start_date=self.MONDAY,
            target_date=None,
            max_daily_readings=2,
            max_daily_chapters=None,
            weekend_multiplier=1.0,
        )

        self.assertEqual(remaining, [])
        # 5 readings, 2/day -> 3 days (2, 2, 1).
        self.assertEqual([len(day["items"]) for day in distributed], [2, 2, 1])

    def test_target_date_too_soon_still_reports_remaining(self):
        """Legitimate 'cannot finish by target' leftovers still surface."""
        schedules = [_schedule(i, i, i) for i in range(1, 6)]  # 5 one-chapter reads
        distributed, remaining = calculate_catchup_schedule(
            schedules,
            start_date=self.MONDAY,
            target_date=date(2026, 1, 7),  # Mon..Wed inclusive -> 3 usable days
            max_daily_readings=1,
            max_daily_chapters=None,
            weekend_multiplier=1.0,
        )

        placed = self._placed_ids(distributed)
        self.assertEqual(len(placed), 3)
        self.assertEqual(len(remaining), 2)
        # Placed + remaining together account for every reading (no loss).
        self.assertCountEqual(
            placed + [s.id for s in remaining], [1, 2, 3, 4, 5]
        )
