from django.db.models import Q


def live_user_filter(prefix=''):
    return Q(**{
        f'{prefix}is_active': True,
        f'{prefix}scheduled_deletion_at__isnull': True,
    })


def is_live_user(user):
    return user.is_active and user.scheduled_deletion_at is None
