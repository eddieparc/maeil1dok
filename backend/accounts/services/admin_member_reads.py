"""Bounded member reads and truthful activity snapshots."""
from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, F, Q, Value, CharField
from django.utils import timezone

from accounts.models import AdminAuditLog, SocialAccount, User, UserReadingSettings
from accounts.services.member_activity import (
    ACTIVITY_SOURCES, dormant_filter, last_active_at, member_status, with_member_activity,
)
from todos.models import DailyBibleSchedule, NotificationSettings, PlanSubscription, UserBibleProgress


def member_queryset(params):
    queryset = with_member_activity(User.objects.all()).select_related(
        'profile', 'reading_settings', 'notification_settings',
    ).prefetch_related('social_accounts')
    q = params['q']
    if q:
        search = Q(nickname__icontains=q) | Q(email__icontains=q)
        numeric = q.removeprefix('#')
        if numeric.isascii() and numeric.isdecimal() and len(numeric) <= 18:
            search |= Q(pk=int(numeric))
        queryset = queryset.filter(search)
    filters = {
        'all': Q(), 'unverified': Q(email_verified=False), 'staff': Q(is_staff=True),
        'dormant': Q(is_active=False) | dormant_filter(),
        'deletion': Q(scheduled_deletion_at__isnull=False),
    }
    order = {'recent': ('-date_joined', '-pk'), 'joined': ('date_joined', 'pk'),
             'streak': ('-profile__current_streak', '-pk')}
    return queryset.filter(filters[params['filter']]).order_by(*order[params['sort']])


def subscription_summaries(users):
    """Same whole-plan, fully-completed-date semantics as the subscription summary.

    Three queries for any member page: subscriptions, plan day sizes, completion
    day sizes. No per-member/subscription queries and no individual progress rows.
    """
    subscriptions = list(PlanSubscription.objects.filter(user_id__in=[u.pk for u in users])
                         .select_related('plan', 'display_settings').order_by('-plan__is_default', 'pk'))
    result = defaultdict(list)
    if not subscriptions:
        return result
    sizes = {(r['plan_id'], r['date']): r['size'] for r in DailyBibleSchedule.objects
             .filter(plan_id__in={s.plan_id for s in subscriptions}).order_by()
             .values('plan_id', 'date').annotate(size=Count('pk'))}
    totals = defaultdict(int)
    for plan_id, _date in sizes:
        totals[plan_id] += 1
    completed = defaultdict(int)
    sub_plan = {s.pk: s.plan_id for s in subscriptions}
    for row in UserBibleProgress.objects.filter(
        subscription_id__in=sub_plan, is_completed=True,
        schedule__plan_id=F('subscription__plan_id'),
    ).order_by().values('subscription_id', 'schedule__date').annotate(size=Count('pk')):
        key = (sub_plan[row['subscription_id']], row['schedule__date'])
        if sizes.get(key) == row['size']:
            completed[row['subscription_id']] += 1
    for subscription in subscriptions:
        total = totals[subscription.plan_id]
        done = completed[subscription.pk]
        display = getattr(subscription, 'display_settings', None)
        result[subscription.user_id].append({
            'id': subscription.pk, 'plan_id': subscription.plan_id, 'name': subscription.plan.name,
            'percent': round(done * 100 / total, 2) if total else 0.0,
            'completed_days': done, 'total_days': total, 'is_default': subscription.plan.is_default,
            'is_active': subscription.is_active, 'is_hidden': not display.is_visible if display else False,
        })
    return result


def member_data(user, subscriptions, *, detail=False):
    profile = getattr(user, 'profile', None)
    providers = sorted({account.provider for account in user.social_accounts.all()})
    if user.is_social and user.social_provider and user.social_provider not in providers:
        providers.append(user.social_provider)
    if user.has_password_set():
        providers.insert(0, 'email')
    selected = next((sub for sub in subscriptions if sub['is_active']), None)
    result = {
        'id': user.pk, 'nickname': user.nickname, 'email': user.email,
        'email_verified': user.email_verified, 'is_staff': user.is_staff, 'is_active': user.is_active,
        'status': member_status(user), 'providers': providers, 'joined_at': user.date_joined,
        'last_active_at': last_active_at(user), 'plan': selected,
        'current_streak': profile.current_streak if profile else 0,
    }
    if detail:
        result.update({
            'total_completed_days': profile.total_completed_days if profile else 0,
            'longest_streak': profile.longest_streak if profile else 0,
            'is_public': profile.is_public if profile else True,
            'has_password': user.has_password_set(), 'token_version': user.token_version,
            'scheduled_deletion_at': user.scheduled_deletion_at, 'is_dormant': user.is_dormant,
            'dormancy_cleared_at': user.dormancy_cleared_at,
            'social_accounts': user.social_accounts.all(), 'subscriptions': subscriptions,
            # Unsaved instances expose actual application defaults without a read-side write.
            'reading_settings': getattr(user, 'reading_settings', None) or UserReadingSettings(),
            'notification_settings': getattr(user, 'notification_settings', None) or NotificationSettings(),
        })
    return result


def activity_queryset(user_id):
    def rows(queryset, timestamp, kind, text):
        return queryset.order_by().annotate(
            at=F(timestamp), kind=Value(kind, output_field=CharField()),
            text=text, source_id=F('pk'),
        ).values('at', 'kind', 'text', 'source_id')

    queries = [rows(User.objects.filter(pk=user_id), 'date_joined', 'signup', Value('Account created'))]
    queries.append(rows(User.objects.filter(pk=user_id, last_login__isnull=False),
                        'last_login', 'login', Value('Latest recorded login')))
    for model, owner, timestamp, kind in ACTIVITY_SOURCES:
        queries.append(rows(model.objects.filter(**{owner: user_id}), timestamp, kind,
                            Value(f'{kind} record saved')))
    queries.append(rows(SocialAccount.objects.filter(user_id=user_id), 'created_at',
                        'social_link', F('provider')))
    queries.append(rows(AdminAuditLog.objects.filter(target_user_id=user_id), 'created_at',
                        'admin_action', F('action')))
    return queries[0].union(*queries[1:], all=True).order_by('-at', 'kind', '-source_id')


def member_stats():
    week = timezone.now() - timedelta(days=7)
    active = Q(last_login__gte=week)
    for index in range(len(ACTIVITY_SOURCES)):
        active |= Q(**{f'observed_{index}__gte': week})
    counts = with_member_activity(User.objects.all()).aggregate(
        total=Count('pk'), weekly_active=Count('pk', filter=active),
        unverified=Count('pk', filter=Q(email_verified=False)),
        scheduled_deletion=Count('pk', filter=Q(scheduled_deletion_at__isnull=False)),
        new_this_week=Count('pk', filter=Q(date_joined__gte=week)),
    )
    counts['deltas'] = dict.fromkeys(('total', 'weekly_active', 'unverified', 'scheduled_deletion'))
    counts['deltas_unavailable_reason'] = 'Historical account and activity snapshots are not retained.'
    return counts
