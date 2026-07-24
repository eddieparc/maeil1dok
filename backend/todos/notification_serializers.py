from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import IntegrityError, transaction
from rest_framework import serializers

from .models import Notification, NotificationPushSubscription, NotificationSettings
from .push_endpoints import InvalidPushEndpoint, validate_push_endpoint_url

PUSH_KEY_MAX_LENGTH = 255


class PushEndpointOwnershipConflict(Exception):
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


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = [
            'notifications_enabled',
            'reading_reminders_enabled',
            'hasena_reminders_enabled',
            'friend_activity_enabled',
            'reading_reminder_time',
            'hasena_reminder_time',
            'timezone',
        ]

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
