"""Whole-plan progress for an already-authorized subscription."""

from typing import TypedDict

from django.db.models import Count, F, FilteredRelation, Q

from todos.models import DailyBibleSchedule, PlanSubscription


class PlanSummary(TypedDict):
    completed_days: int
    total_days: int
    percent: float


def get_plan_summary(subscription: PlanSubscription) -> PlanSummary:
    """Return distinct scheduled dates and fully completed dates in one query.

    The caller must authorize the subscription. Include all dates in its plan,
    regardless of start date, current date or visibility. A date is complete only
    if every scheduled row has is_completed=True for this exact subscription.
    Percent is rounded to two decimal places; an unscheduled plan is all zero.
    """
    days = (
        DailyBibleSchedule.objects.filter(plan_id=subscription.plan_id)
        .order_by()
        .annotate(subscription_progress=FilteredRelation(
            'progress_records',
            condition=Q(progress_records__subscription_id=subscription.pk),
        ))
        .values('date')
        .annotate(
            scheduled_rows=Count('pk', distinct=True),
            completed_rows=Count(
                'subscription_progress',
                filter=Q(subscription_progress__is_completed=True),
                distinct=True,
            ),
        )
    )
    counts = days.aggregate(
        total_days=Count('date'),
        completed_days=Count('date', filter=Q(scheduled_rows=F('completed_rows'))),
    )
    completed_days = counts['completed_days']
    total_days = counts['total_days']
    return {
        'completed_days': completed_days,
        'total_days': total_days,
        'percent': round(completed_days * 100 / total_days, 2) if total_days else 0.0,
    }
