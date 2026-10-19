"""Persist intake only; no mail transport or external delivery is implied."""
from django.db import transaction

from accounts.models import SupportInquiry


@transaction.atomic
def receive_inquiry(*, user, kind, message, reply_email):
    return SupportInquiry.objects.create(
        user=user if user.is_authenticated else None,
        kind=kind,
        message=message,
        reply_email=reply_email,
    )
