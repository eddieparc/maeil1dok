"""Staff member operations. Ordered account row locks serialize decisions and writes."""
from datetime import timedelta
from uuid import uuid4

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from accounts import email_utils, handoff
from accounts.models import AdminAuditLog, EmailVerificationToken, PasswordResetToken, User

ACTIONS = (
    'verify_email', 'unverify_email', 'resend_verification', 'send_password_reset',
    'revoke_sessions', 'grant_staff', 'revoke_staff', 'set_dormant', 'clear_dormant',
    'deactivate', 'activate', 'schedule_deletion', 'cancel_deletion', 'unlink_social',
)
BULK_ACTIONS = ('resend_verification', 'revoke_sessions', 'deactivate')


class ActionRejected(Exception):
    pass


def _require(condition, code):
    if not condition:
        raise ActionRejected(code)


def _apply(user, action, provider):
    fields = []
    revoke = False
    if action in ('verify_email', 'unverify_email'):
        _require(user.email, 'email_required')
        value = action == 'verify_email'
        revoke = user.email_verified and not value
        user.email_verified = value
        fields = ['email_verified']
        EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)
    elif action in ('resend_verification', 'send_password_reset'):
        _require(user.is_active and not user.scheduled_deletion_at, 'account_not_active')
        _require(user.email, 'email_required')
        if action == 'resend_verification':
            _require(not user.email_verified, 'already_verified')
            token = EmailVerificationToken.create_token(user, user.email, expiry_hours=0.5)
            sent = email_utils.send_verification_email(user.email, token.token, user.nickname, expiry_minutes=30)
        else:
            _require(user.has_password_set() or user.email_verified, 'social_only_unverified')
            token = PasswordResetToken.create_token(user)
            sent = email_utils.send_password_reset_email(user.email, token.token, user.nickname)
        _require(sent, 'mail_delivery_failed')
    elif action == 'revoke_sessions':
        revoke = True
    elif action in ('grant_staff', 'revoke_staff'):
        value = action == 'grant_staff'
        revoke = user.is_staff != value
        user.is_staff = value
        fields = ['is_staff']
    elif action in ('set_dormant', 'clear_dormant'):
        user.is_dormant = action == 'set_dormant'
        fields = ['is_dormant']
        if action == 'clear_dormant':
            user.dormancy_cleared_at = timezone.now()
            fields.append('dormancy_cleared_at')
    elif action in ('deactivate', 'activate'):
        if action == 'activate':
            _require(not user.merged_into_id, 'merged_account')
            _require(not user.scheduled_deletion_at, 'cancel_deletion_first')
        value = action == 'activate'
        revoke = user.is_active != value
        user.is_active = value
        fields = ['is_active']
    elif action == 'schedule_deletion':
        _require(not user.merged_into_id, 'merged_account')
        _require(not user.scheduled_deletion_at, 'already_scheduled')
        user.scheduled_deletion_at = timezone.now() + timedelta(days=14)
        user.is_active = False
        fields = ['scheduled_deletion_at', 'is_active']
        revoke = True
    elif action == 'cancel_deletion':
        # Preserve existing restoration deadline, merged-account and token policy.
        from accounts.views import _restore_scheduled_deletion_account
        restored, _message = _restore_scheduled_deletion_account(user)
        _require(restored, 'account_not_restorable')
        handoff.mark_logged_out(cache, user.pk)
    elif action == 'unlink_social':
        linked = list(user.social_accounts.select_for_update().order_by('pk'))
        account = next((account for account in linked if account.provider == provider), None)
        _require(account is not None, 'provider_not_linked')
        _require(user.can_unlink_provider(provider), 'last_login_method')
        account.delete()
        if user.social_provider == provider:
            replacement = next((item for item in linked if item.provider != provider), None)
            user.social_provider = replacement.provider if replacement else None
            user.social_id = replacement.provider_id if replacement else None
            user.is_social = replacement is not None
            fields = ['social_provider', 'social_id', 'is_social']
        revoke = True
    if revoke:
        user.token_version += 1
        fields.append('token_version')
    if fields:
        user.save(update_fields=fields)
    if revoke:
        # Fail closed for already-issued session bridge credentials, too.
        handoff.mark_logged_out(cache, user.pk)
    if action in ('set_dormant', 'clear_dormant', 'deactivate', 'activate',
                  'schedule_deletion', 'cancel_deletion'):
        transaction.on_commit(lambda: cache.set('member_eligibility_generation', uuid4().hex, timeout=None))
    return user.token_version


@transaction.atomic
def perform_actions(actor_id, ids, action, provider=None, *, bulk=False):
    locked = {user.pk: user for user in User.objects.select_for_update()
              .filter(pk__in=set(ids) | {actor_id}).order_by('pk')}
    actor = locked.get(actor_id)
    if actor is None or not actor.is_active or not actor.is_staff:
        raise PermissionDenied()
    results = []
    for user_id in ids:
        user = locked.get(user_id)
        code = None
        token_version = user.token_version if user else None
        try:
            with transaction.atomic():
                _require(user is not None, 'member_not_found')
                token_version = _apply(user, action, provider)
        except ActionRejected as exc:
            code = str(exc)
        except IntegrityError as exc:
            from accounts.views import _is_active_email_identity_conflict
            if not _is_active_email_identity_conflict(exc):
                raise
            code = 'identity_conflict'
        payload = {'bulk': bulk, 'target_id': user_id, 'outcome': code or 'applied'}
        if provider is not None:
            payload['provider'] = provider
        AdminAuditLog.objects.create(actor=actor, target_user=user, action=action, payload=payload)
        results.append({'id': user_id, 'success': code is None, 'error': code,
                        'token_version': token_version})
    return results
