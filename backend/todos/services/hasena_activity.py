from collections import defaultdict
from datetime import date, timedelta

from django.db.models import Count, Q
from django.utils import timezone


def _get_month_end(month_start):
    if month_start.month == 12:
        return date(month_start.year + 1, 1, 1)
    return date(month_start.year, month_start.month + 1, 1)


def get_hasena_period_filter(period, month_start=None):
    if period == "week":
        return timezone.now().date() - timedelta(days=7), None
    if period == "month":
        start = month_start or timezone.now().date().replace(day=1)
        return start, _get_month_end(start)
    return None, None


def get_hasena_count_annotation(period, month_start=None):
    progress_filter = Q(hasenarecord__is_completed=True)
    start_date, end_date = get_hasena_period_filter(period, month_start)
    if start_date:
        progress_filter &= Q(hasenarecord__date__gte=start_date)
    if end_date:
        progress_filter &= Q(hasenarecord__date__lt=end_date)

    return Count(
        "hasenarecord__date",
        filter=progress_filter,
        distinct=True,
    )


def calculate_hasena_activity_stats(user):
    stats = calculate_hasena_activity_stats_bulk([user])
    return stats.get(user.id, _empty_stats())


def calculate_hasena_activity_stats_bulk(users):
    user_ids = [user.id for user in users]
    if not user_ids:
        return {}

    from todos.models import HasenaRecord

    dates_by_user = defaultdict(set)
    records = (
        HasenaRecord.objects
        .filter(user_id__in=user_ids, is_completed=True)
        .values_list("user_id", "date")
        .order_by("user_id", "date")
    )
    for user_id, completed_date in records:
        dates_by_user[user_id].add(completed_date)

    return {
        user_id: _stats_from_dates(dates_by_user.get(user_id, set()))
        for user_id in user_ids
    }


def _empty_stats():
    return {
        "total_completed": 0,
        "current_streak": 0,
        "longest_streak": 0,
    }


def _stats_from_dates(completed_dates):
    if not completed_dates:
        return _empty_stats()

    today = timezone.now().date()
    return {
        "total_completed": len(completed_dates),
        "current_streak": _calculate_current_streak(completed_dates, today),
        "longest_streak": _calculate_longest_streak(completed_dates),
    }


def _calculate_current_streak(completed_dates, today):
    streak = 0
    check_date = today

    while True:
        if _is_rest_day(check_date):
            check_date -= timedelta(days=1)
            continue

        if check_date in completed_dates:
            streak += 1
            check_date -= timedelta(days=1)
            continue

        if check_date == today:
            check_date -= timedelta(days=1)
            continue

        return streak


def _calculate_longest_streak(completed_dates):
    required_completed_dates = [
        completed_date
        for completed_date in completed_dates
        if not _is_rest_day(completed_date)
    ]
    if not required_completed_dates:
        return 0

    longest_streak = 0
    temp_streak = 0
    previous_date = None

    for completed_date in sorted(required_completed_dates, reverse=True):
        if previous_date is None:
            temp_streak = 1
        elif _has_no_required_day_gap(completed_date, previous_date):
            temp_streak += 1
        else:
            temp_streak = 1

        longest_streak = max(longest_streak, temp_streak)
        previous_date = completed_date

    return longest_streak


def _has_no_required_day_gap(older_date, newer_date):
    check_date = older_date + timedelta(days=1)
    required_days_between = 0

    while check_date <= newer_date:
        if not _is_rest_day(check_date):
            required_days_between += 1
        check_date += timedelta(days=1)

    return required_days_between <= 1


def _is_rest_day(value):
    return value.weekday() == 6
