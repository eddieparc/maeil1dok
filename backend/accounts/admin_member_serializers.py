"""Explicit staff-only contracts. Never serialize credential or provider token fields."""
from rest_framework import serializers

from accounts.models import SocialAccount, UserReadingSettings
from accounts.services.admin_members import ACTIONS, BULK_ACTIONS
from todos.models import NotificationSettings


class MemberQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, default='', allow_blank=True, max_length=254)
    filter = serializers.ChoiceField(choices=('all', 'unverified', 'staff', 'dormant', 'deletion'), default='all')
    sort = serializers.ChoiceField(choices=('recent', 'joined', 'streak'), default='recent')
    page = serializers.IntegerField(min_value=1, default=1)
    masked = serializers.BooleanField(default=True)


class MemberActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ACTIONS)
    provider = serializers.ChoiceField(choices=('apple', 'google', 'kakao'), required=False)

    def validate(self, attrs):
        if (attrs['action'] == 'unlink_social') != ('provider' in attrs):
            raise serializers.ValidationError({'provider': 'Required only for unlink_social.'})
        return attrs


class MemberBulkSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=BULK_ACTIONS)
    ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1, max_length=50)

    def validate_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError('Duplicate member IDs are not allowed.')
        return value


class MemberPlanSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    percent = serializers.FloatField()
    completed_days = serializers.IntegerField()
    total_days = serializers.IntegerField()


class MemberSubscriptionSerializer(MemberPlanSerializer):
    plan_id = serializers.IntegerField()
    is_default = serializers.BooleanField()
    is_active = serializers.BooleanField()
    is_hidden = serializers.BooleanField()


class MemberListItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.CharField()
    email = serializers.EmailField(allow_null=True, allow_blank=True)
    email_verified = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    is_active = serializers.BooleanField()
    status = serializers.ChoiceField(choices=('active', 'dormant', 'inactive', 'deletion'))
    providers = serializers.ListField(child=serializers.CharField())
    joined_at = serializers.DateTimeField()
    last_active_at = serializers.DateTimeField(allow_null=True)
    plan = MemberPlanSerializer(allow_null=True)
    current_streak = serializers.IntegerField()


class MemberListSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.IntegerField(allow_null=True)
    previous = serializers.IntegerField(allow_null=True)
    results = MemberListItemSerializer(many=True)


class MemberSocialSerializer(serializers.ModelSerializer):
    provider = serializers.ChoiceField(choices=('apple', 'google', 'kakao'), read_only=True)

    class Meta:
        model = SocialAccount
        fields = ('provider', 'provider_id', 'created_at')
        read_only_fields = fields


class MemberReadingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReadingSettings
        fields = ('theme', 'font_family', 'font_size', 'font_weight', 'line_height',
                  'text_align', 'verse_joining', 'show_verse_numbers', 'show_description',
                  'show_cross_ref', 'highlight_names', 'show_footnotes', 'tongdok_auto_complete')
        read_only_fields = fields


class MemberNotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = ('notifications_enabled', 'reading_reminders_enabled', 'hasena_reminders_enabled',
                  'friend_activity_enabled', 'weekly_summary_enabled', 'service_notice_enabled',
                  'reading_reminder_time', 'hasena_reminder_time', 'timezone')
        read_only_fields = fields


class MemberDetailSerializer(MemberListItemSerializer):
    total_completed_days = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    is_public = serializers.BooleanField()
    has_password = serializers.BooleanField()
    token_version = serializers.IntegerField()
    scheduled_deletion_at = serializers.DateTimeField(allow_null=True)
    is_dormant = serializers.BooleanField()
    dormancy_cleared_at = serializers.DateTimeField(allow_null=True)
    social_accounts = MemberSocialSerializer(many=True)
    subscriptions = MemberSubscriptionSerializer(many=True)
    reading_settings = MemberReadingSettingsSerializer()
    notification_settings = MemberNotificationSettingsSerializer()


class MemberActionResultSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    success = serializers.BooleanField()
    error = serializers.CharField(allow_null=True)
    token_version = serializers.IntegerField(allow_null=True)


class MemberBulkResultSerializer(serializers.Serializer):
    results = MemberActionResultSerializer(many=True)


class MemberActivityItemSerializer(serializers.Serializer):
    at = serializers.DateTimeField()
    kind = serializers.CharField()
    text = serializers.CharField()
    source_id = serializers.IntegerField()


class MemberActivitySerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.IntegerField(allow_null=True)
    previous = serializers.IntegerField(allow_null=True)
    results = MemberActivityItemSerializer(many=True)


class MemberDeltasSerializer(serializers.Serializer):
    total = serializers.IntegerField(allow_null=True)
    weekly_active = serializers.IntegerField(allow_null=True)
    unverified = serializers.IntegerField(allow_null=True)
    scheduled_deletion = serializers.IntegerField(allow_null=True)


class MemberStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    weekly_active = serializers.IntegerField()
    unverified = serializers.IntegerField()
    scheduled_deletion = serializers.IntegerField()
    new_this_week = serializers.IntegerField()
    deltas = MemberDeltasSerializer()
    deltas_unavailable_reason = serializers.CharField()
