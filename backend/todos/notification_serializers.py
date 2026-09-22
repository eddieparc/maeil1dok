import re
import uuid
from datetime import timezone as datetime_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import IntegrityError, transaction
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import (
    NativePushSubscription,
    NativePushOptOut,
    Notification,
    NotificationPushSubscription,
    NotificationSettings,
)
from .push_endpoints import InvalidPushEndpoint, validate_push_endpoint_url

PUSH_KEY_MAX_LENGTH = 255
EXPO_TOKEN_PATTERN = re.compile(r'^(ExponentPushToken|ExpoPushToken)\[[^\[\]]+\]$')


class PushEndpointOwnershipConflict(Exception):
    pass


class NativePushOwnershipConflict(Exception):
    pass


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    target_url = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'title', 'body', 'target_url', 'data',
            'actor_name', 'is_read', 'read_at', 'created_at',
        ]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.nickname
        return None

    def get_is_read(self, obj):
        return obj.read_at is not None

    def get_target_url(self, obj):
        target_url = obj.target_url or ''
        allowed_prefixes = (
            '/bible',
            '/friends',
            '/hasena',
            '/notifications',
            '/plan',
            '/plans',
            '/profile/',
        )
        if target_url == '' or target_url.startswith(allowed_prefixes):
            return target_url
        return '/notifications'


class NotificationPauseDateTimeField(serializers.DateTimeField):
    """UTC on the wire; use the configured local clock in a naive database."""

    def __init__(self, **kwargs):
        super().__init__(default_timezone=datetime_timezone.utc, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not settings.USE_TZ:
            value = timezone.make_naive(value, timezone.get_default_timezone())
        return value

    def to_representation(self, value):
        if value is not None and timezone.is_naive(value):
            value = timezone.make_aware(value, timezone.get_default_timezone())
        return super().to_representation(value)


class ReminderWeekdaysField(serializers.ListField):
    child = serializers.IntegerField(min_value=0, max_value=6)

    def to_internal_value(self, data):
        if not isinstance(data, list) or any(type(item) is not int for item in data):
            raise serializers.ValidationError('요일은 0~6 정수의 배열이어야 합니다.')
        return list(dict.fromkeys(super().to_internal_value(data)))


class NotificationSettingsSerializer(serializers.ModelSerializer):
    paused_until = NotificationPauseDateTimeField(allow_null=True, required=False)
    reminder_weekdays = ReminderWeekdaysField(required=False)
    class Meta:
        model = NotificationSettings
        fields = [
            'notifications_enabled',
            'reading_reminders_enabled',
            'hasena_reminders_enabled',
            'friend_activity_enabled',
            'reading_reminder_time',
            'hasena_reminder_time',
            'streak_reminders_enabled',
            'streak_reminder_time',
            'reminder_weekdays',
            'quiet_hours_enabled',
            'quiet_hours_start',
            'quiet_hours_end',
            'paused_until',
            'daily_push_limit',
            'timezone',
        ]

    daily_push_limit = serializers.IntegerField(min_value=1, max_value=10)

    def validate(self, attrs):
        instance = self.instance

        def effective(field):
            if field in attrs:
                return attrs[field]
            return getattr(instance, field) if instance is not None else None

        if effective('quiet_hours_enabled'):
            start = effective('quiet_hours_start')
            end = effective('quiet_hours_end')
            if start is not None and start == end:
                raise serializers.ValidationError(
                    {'quiet_hours_end': '방해 금지 시작과 종료 시각이 같을 수 없습니다.'}
                )
        return attrs

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError, TypeError):
            raise serializers.ValidationError('지원하지 않는 시간대입니다.')
        return value


class NotificationPushSubscriptionSerializer(serializers.ModelSerializer):
    keys = serializers.DictField(write_only=True)

    class Meta:
        model = NotificationPushSubscription
        fields = ['endpoint', 'keys']
        extra_kwargs = {
            'endpoint': {'validators': []},
        }

    def validate_endpoint(self, value):
        try:
            return validate_push_endpoint_url(value)
        except InvalidPushEndpoint as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def _validate_key_field(self, value, field_label):
        if not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError(f'{field_label} 키가 필요합니다.')
        if len(value) > PUSH_KEY_MAX_LENGTH:
            raise serializers.ValidationError(
                f'{field_label} 키가 너무 깁니다. (최대 {PUSH_KEY_MAX_LENGTH}자)'
            )

    def validate_keys(self, value):
        self._validate_key_field(value.get('p256dh'), 'p256dh')
        self._validate_key_field(value.get('auth'), 'auth')
        return value

    def create_or_update(self, user, user_agent=''):
        keys = self.validated_data['keys']
        endpoint = self.validated_data['endpoint']
        try:
            return self._create_or_update_locked(user, endpoint, keys, user_agent)
        except IntegrityError:
            return self._resolve_endpoint_integrity_race(user, endpoint, keys, user_agent)

    def _create_or_update_locked(self, user, endpoint, keys, user_agent):
        with transaction.atomic():
            subscription = (
                NotificationPushSubscription.objects
                .select_for_update()
                .filter(endpoint=endpoint)
                .first()
            )
            if subscription is None:
                return NotificationPushSubscription.objects.create(
                    user=user,
                    endpoint=endpoint,
                    p256dh=keys['p256dh'],
                    auth=keys['auth'],
                    user_agent=user_agent[:255],
                )
            if subscription.user_id != user.id:
                raise PushEndpointOwnershipConflict

            return self._update_subscription(subscription, keys, user_agent)

    def _resolve_endpoint_integrity_race(self, user, endpoint, keys, user_agent):
        with transaction.atomic():
            subscription = (
                NotificationPushSubscription.objects
                .select_for_update()
                .get(endpoint=endpoint)
            )
            if subscription.user_id != user.id:
                raise PushEndpointOwnershipConflict

            return self._update_subscription(subscription, keys, user_agent)

    def _update_subscription(self, subscription, keys, user_agent):
        subscription.p256dh = keys['p256dh']
        subscription.auth = keys['auth']
        subscription.user_agent = user_agent[:255]
        subscription.enabled = True
        subscription.failure_count = 0
        subscription.last_failure_at = None
        subscription.save(update_fields=[
            'p256dh',
            'auth',
            'user_agent',
            'enabled',
            'failure_count',
            'last_failure_at',
            'updated_at',
        ])
        return subscription


class NativePushSubscriptionSerializer(serializers.Serializer):
    """네이티브 푸시 구독 등록/상태/해제 공통 입력.

    token 과 installation_id 는 응답·로그에 다시 노출하지 않는다.
    """

    token = serializers.CharField(max_length=255)
    installation_id = serializers.CharField(max_length=64)

    def validate_token(self, value):
        if not EXPO_TOKEN_PATTERN.match(value):
            raise serializers.ValidationError('유효한 Expo push token 형식이 아닙니다.')
        return value

    def validate_installation_id(self, value):
        try:
            return str(uuid.UUID(value))
        except (ValueError, AttributeError, TypeError):
            raise serializers.ValidationError('installation_id는 UUID 형식이어야 합니다.')


class NativePushSubscriptionRemoveSerializer(NativePushSubscriptionSerializer):
    # Removal revokes by user + installation_id, so the token is optional: a
    # shell whose cached token is stale or missing must still be able to
    # revoke. When supplied it is still validated by validate_token.
    token = serializers.CharField(max_length=255, required=False)
    opt_out = serializers.BooleanField(default=True)


class NativePushSubscriptionRegisterSerializer(NativePushSubscriptionSerializer):
    platform = serializers.ChoiceField(choices=NativePushSubscription.PLATFORM_CHOICES)
    explicit = serializers.BooleanField(default=True)

    def register(self, user):
        """Idempotent register/rotate/rebind for the caller's installation.

        - same user + same token: refresh platform/installation, re-enable.
        - same installation_id: rotate token (device proof of possession).
        - token owned by another user: rebind only when the row is disabled
          (prior owner released it) or the installation_id matches (device
          handoff); otherwise raise NativePushOwnershipConflict.
        """
        token = self.validated_data['token']
        platform = self.validated_data['platform']
        installation_id = uuid.UUID(self.validated_data['installation_id'])
        try:
            return self._register_locked(user, token, platform, installation_id)
        except IntegrityError:
            return self._register_locked(user, token, platform, installation_id)

    def _register_locked(self, user, token, platform, installation_id):
        with transaction.atomic():
            user.__class__.objects.select_for_update().get(pk=user.pk)
            opt_out = NativePushOptOut.objects.filter(user=user, installation_id=installation_id)
            if not self.validated_data['explicit'] and opt_out.exists():
                return None
            by_token = (
                NativePushSubscription.objects
                .select_for_update()
                .filter(token=token)
                .first()
            )
            by_install = (
                NativePushSubscription.objects
                .select_for_update()
                .filter(installation_id=installation_id)
                .first()
            )

            if by_token is not None and by_token.user_id == user.id:
                if by_install is not None and by_install.pk != by_token.pk:
                    raise NativePushOwnershipConflict
                opt_out.delete()
                return self._update(
                    by_token,
                    platform=platform,
                    installation_id=installation_id,
                )

            if by_token is not None:
                # Token belongs to another account. Rebind only when the row
                # is disabled (prior owner released it) or the caller holds
                # the same installation_id (device handoff proof).
                foreign_enabled = by_token.enabled and (
                    by_token.installation_id != installation_id
                )
                if foreign_enabled:
                    raise NativePushOwnershipConflict
                if by_install is not None and by_install.id != by_token.id:
                    if by_install.enabled and by_install.user_id != user.id:
                        raise NativePushOwnershipConflict
                    by_install.delete()
                opt_out.delete()
                return self._update(
                    by_token,
                    user=user,
                    platform=platform,
                    installation_id=installation_id,
                )

            if by_install is not None:
                if by_install.user_id != user.id and by_install.enabled:
                    raise NativePushOwnershipConflict
                opt_out.delete()
                return self._update(
                    by_install,
                    user=user,
                    token=token,
                    platform=platform,
                )

            opt_out.delete()
            return NativePushSubscription.objects.create(
                user=user,
                token=token,
                platform=platform,
                installation_id=installation_id,
            )

    def _update(self, subscription, **fields):
        subscription.generation += 1
        for field, value in fields.items():
            setattr(subscription, field, value)
        subscription.enabled = True
        subscription.failure_count = 0
        subscription.last_failure_at = None
        subscription.save()
        return subscription
