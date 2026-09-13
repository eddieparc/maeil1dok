"""Observed activity and operational dormancy; never synthesize login history."""
from datetime import timedelta

from django.conf import settings
from django.db.models import DateTimeField, F, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce, Greatest
from django.utils import timezone

from accounts.models import User
from todos.models import (
    BibleBookmark, BibleHighlight, HasenaRecord, PersonalReadingRecord,
    ReflectionNote, UserBibleProgress, UserReadingPosition, UserVideoIntroProgress,
)

# These timestamps record actual writes. Mutable rows are snapshots, not an event journal.
ACTIVITY_SOURCES = (
    (UserBibleProgress, 'subscription__user_id', 'updated_at', 'reading'),
    (PersonalReadingRecord, 'user_id', 'created_at', 'personal_reading'),
    (UserReadingPosition, 'user_id', 'updated_at', 'reading_position'),
    (HasenaRecord, 'user_id', 'updated_at', 'hasena'),
    (UserVideoIntroProgress, 'user_id', 'updated_at', 'video'),
    (BibleBookmark, 'user_id', 'updated_at', 'bookmark'),
    (BibleHighlight, 'user_id', 'updated_at', 'highlight'),
    (ReflectionNote, 'user_id', 'updated_at', 'note'),
)


def with_member_activity(queryset):
    # Greatest has different NULL behavior on SQLite/MySQL. Coalesce each operand
    # to date_joined for eligibility, but keep last_active_at genuinely nullable.
    annotations = {}
    for index, (model, owner, timestamp, _kind) in enumerate(ACTIVITY_SOURCES):
        annotations[f'observed_{index}'] = Subquery(
            model.objects.filter(**{owner: OuterRef('pk')}).order_by(f'-{timestamp}')
            .values(timestamp)[:1], output_field=DateTimeField(),
        )
    queryset = queryset.annotate(**annotations)
    return queryset.annotate(dormancy_reference=Greatest(
        F('date_joined'), Coalesce('last_login', 'date_joined'),
        Coalesce('dormancy_cleared_at', 'date_joined'),
        *(Coalesce(name, 'date_joined') for name in annotations),
    ))


def dormant_filter(now=None):
    now = now or timezone.now()
    # Notification clocks may be timezone-aware while legacy DB timestamps are naive.
    if not settings.USE_TZ and timezone.is_aware(now):
        now = timezone.make_naive(now, timezone.get_default_timezone())
    return Q(is_dormant=True) | Q(dormancy_reference__lte=now - timedelta(days=30))


def eligible_members(queryset=None):
    return with_member_activity(queryset if queryset is not None else User.objects.all()).filter(
        is_active=True, scheduled_deletion_at__isnull=True,
    ).exclude(dormant_filter())


def last_active_at(user):
    values = [user.last_login, *(getattr(user, f'observed_{i}') for i in range(len(ACTIVITY_SOURCES)))]
    return max((value for value in values if value is not None), default=None)


def member_status(user):
    if user.scheduled_deletion_at:
        return 'deletion'
    if not user.is_active:
        return 'inactive'
    if user.is_dormant or user.dormancy_reference <= timezone.now() - timedelta(days=30):
        return 'dormant'
    return 'active'
