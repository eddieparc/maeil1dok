from django.db.models import QuerySet
from django.http import QueryDict
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError

from todos.models import BibleReadingPlan, DailyBibleSchedule


class ChapterScheduleSelector(serializers.Serializer):
    schedule_id = serializers.IntegerField(min_value=1, required=False)
    date = serializers.DateField(required=False)


def select_chapter_schedule(
    plan: BibleReadingPlan,
    candidates: QuerySet[DailyBibleSchedule],
    query: QueryDict,
) -> DailyBibleSchedule | None:
    selector = ChapterScheduleSelector(data=query)
    selector.is_valid(raise_exception=True)
    selected_date = selector.validated_data.get("date")
    schedule_id = selector.validated_data.get("schedule_id")

    if schedule_id is not None:
        selected = plan.schedules.filter(pk=schedule_id).only("date").first()
        if selected is None:
            raise NotFound({"schedule_id": "이 플랜의 일정이 아니에요."})
        if selected_date is not None and selected_date != selected.date:
            raise ValidationError({"date": "선택한 일정의 날짜와 일치하지 않아요."})
        selected_date = selected.date

    if selected_date is not None:
        candidates = candidates.filter(date=selected_date)
    return candidates.first()
