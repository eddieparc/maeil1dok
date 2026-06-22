from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from .models import Notification, NotificationPushSubscription, NotificationSettings
from .push_endpoints import InvalidPushEndpoint, validate_push_endpoint_url


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
        except ZoneInfoNotFoundError:
            raise serializers.ValidationError('지원하지 않는 시간대입니다.')
        return value


class NotificationPushSubscriptionSerializer(serializers.ModelSerializer):
    keys = serializers.DictField(write_only=True)

    class Meta:
        model = NotificationPushSubscription
        fields = ['endpoint', 'keys']

    def validate_endpoint(self, value):
        try:
            return validate_push_endpoint_url(value)
        except InvalidPushEndpoint as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate_keys(self, value):
        p256dh = value.get('p256dh')
        auth = value.get('auth')
        if not isinstance(p256dh, str) or not p256dh.strip():
            raise serializers.ValidationError('p256dh 키가 필요합니다.')
        if not isinstance(auth, str) or not auth.strip():
            raise serializers.ValidationError('auth 키가 필요합니다.')
        return value

    def create_or_update(self, user, user_agent=''):
        keys = self.validated_data['keys']
        subscription, _ = NotificationPushSubscription.objects.update_or_create(
            endpoint=self.validated_data['endpoint'],
            defaults={
                'user': user,
                'p256dh': keys['p256dh'],
                'auth': keys['auth'],
                'user_agent': user_agent[:255],
                'enabled': True,
                'failure_count': 0,
                'last_failure_at': None,
            },
        )
        return subscription
