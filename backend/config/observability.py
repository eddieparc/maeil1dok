import logging
import os

from config.logging_config import redact_log_text

logger = logging.getLogger(__name__)


REMINDER_HEARTBEAT_CACHE_KEY = 'observability:send_due_notification_reminders:last_run'
REMINDER_DEADMAN_TIMEOUT_SECONDS = 15 * 60
REMINDER_UNKNOWN_SINCE_CACHE_KEY = 'observability:send_due_notification_reminders:unknown_since'
REMINDER_UNKNOWN_GRACE_SECONDS = REMINDER_DEADMAN_TIMEOUT_SECONDS
HASENA_SUMMARY_HEARTBEAT_CACHE_KEY = 'observability:generate_hasena_summary:last_run'
HASENA_SUMMARY_UNKNOWN_SINCE_CACHE_KEY = 'observability:generate_hasena_summary:unknown_since'
HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS = REMINDER_DEADMAN_TIMEOUT_SECONDS
HASENA_SUMMARY_UNKNOWN_GRACE_SECONDS = HASENA_SUMMARY_DEADMAN_TIMEOUT_SECONDS
_SENSITIVE_SENTRY_KEYS = {
    'access',
    'accesstoken',
    'apikey',
    'authorization',
    'clientsecret',
    'code',
    'cookie',
    'csrftoken',
    'email',
    'idtoken',
    'ipaddress',
    'password',
    'phonenumber',
    'proxyauthorization',
    'refreshtoken',
    'secret',
    'sessionid',
    'setcookie',
    'signuptoken',
    'state',
    'token',
    'username',
    'xapikey',
}


def _normalise_sentry_key(key):
    return ''.join(character for character in str(key).lower() if character.isalnum())


def _scrub_sentry_value(value, seen):
    if isinstance(value, str):
        return redact_log_text(value)
    if isinstance(value, list):
        return [_scrub_sentry_value(item, seen) for item in value]
    if not isinstance(value, dict) or id(value) in seen:
        return value

    seen.add(id(value))
    for key, nested in list(value.items()):
        if _normalise_sentry_key(key) in _SENSITIVE_SENTRY_KEYS:
            value[key] = '[redacted]'
        else:
            value[key] = _scrub_sentry_value(nested, seen)
    return value


def scrub_sentry_event(event, _hint=None):
    if not isinstance(event, dict):
        return event

    extra = event.get('extra')
    if isinstance(extra, dict) and extra.pop('_skip_sentry_duplicate', False) is True:
        return None

    _scrub_sentry_value(event, set())
    user = event.get('user')
    if isinstance(user, dict):
        for key in ('email', 'ip_address', 'username'):
            user.pop(key, None)

    request = event.get('request')
    if isinstance(request, dict):
        headers = request.get('headers')
        if isinstance(headers, dict):
            for key in list(headers):
                if _normalise_sentry_key(key) in _SENSITIVE_SENTRY_KEYS:
                    headers.pop(key, None)
    return event


def parse_sample_rate(value, default=0.0):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if 0 <= parsed <= 1 else default


def env_bool(name, default=False):
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.lower() in {'true', '1', 'yes'}


def init_sentry_from_env():
    dsn = os.environ.get('SENTRY_DSN')
    if not dsn:
        return False

    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get('SENTRY_ENVIRONMENT'),
        release=os.environ.get('SENTRY_RELEASE'),
        traces_sample_rate=parse_sample_rate(os.environ.get('SENTRY_TRACES_SAMPLE_RATE')),
        send_default_pii=env_bool('SENTRY_SEND_DEFAULT_PII'),
        before_send=scrub_sentry_event,
        before_send_transaction=scrub_sentry_event,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            LoggingIntegration(event_level=logging.ERROR),
        ],
    )
    return True


def capture_observability_event(
    message,
    *,
    level='info',
    tags=None,
    extra=None,
    exception=None,
    isolate_request_context=False,
):
    try:
        import sentry_sdk
    except ImportError:
        return False

    try:
        if isolate_request_context:
            original_current_scope = sentry_sdk.get_current_scope()
            original_isolation_scope = sentry_sdk.get_isolation_scope()
            client = sentry_sdk.get_client()
            current_scope = sentry_sdk.Scope(client=client)
            isolation_scope = sentry_sdk.Scope(client=client)
            sentry_sdk.Scope.set_current_scope(current_scope)
            sentry_sdk.Scope.set_isolation_scope(isolation_scope)
            try:
                for key, value in (tags or {}).items():
                    current_scope.set_tag(key, value)
                for key, value in (extra or {}).items():
                    current_scope.set_extra(key, value)
                if exception is not None:
                    sentry_sdk.capture_exception(exception)
                else:
                    sentry_sdk.capture_message(message, level=level)
            finally:
                sentry_sdk.Scope.set_current_scope(original_current_scope)
                sentry_sdk.Scope.set_isolation_scope(original_isolation_scope)
            return True

        with sentry_sdk.push_scope() as scope:
            for key, value in (tags or {}).items():
                scope.set_tag(key, value)
            for key, value in (extra or {}).items():
                scope.set_extra(key, value)
            if exception is not None:
                sentry_sdk.capture_exception(exception)
            else:
                sentry_sdk.capture_message(message, level=level)
        return True
    except Exception:
        logger.debug('Failed to capture observability event', exc_info=True)
        return False
