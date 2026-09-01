"""Output-only serializers for function-based account API responses."""

from drf_spectacular.utils import PolymorphicProxySerializer
from rest_framework import serializers

from .serializers import (
    FollowSerializer,
    NotificationSettingsSerializer,
    ReadingSettingsSerializer,
    TokenPairResponseSerializer,
    UserSearchSerializer,
    UserSerializer,
)


class AvailabilityResponseSerializer(serializers.Serializer):
    available = serializers.BooleanField()



class AccountEmailResponseSerializer(serializers.Serializer):
    email = serializers.EmailField(allow_blank=True)
    email_verified = serializers.BooleanField()


class AccountEmailUpdateResponseSerializer(AccountEmailResponseSerializer):
    success = serializers.BooleanField()
    message = serializers.CharField()


class CsrfTokenResponseSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class ErrorResponseSerializer(serializers.Serializer):
    error = serializers.CharField()


class SocialAuthErrorSerializer(serializers.Serializer):
    error = serializers.CharField()
    error_code = serializers.CharField()
    request_id = serializers.CharField(allow_blank=True)
    field = serializers.CharField(required=False)
    action = serializers.CharField(required=False)
    field_errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
    )


class AccountSuccessMessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()


class DeleteAccountResponseSerializer(AccountSuccessMessageResponseSerializer):
    scheduled_deletion_at = serializers.DateTimeField()


class AuthenticatedUserResponseSerializer(serializers.Serializer):
    authenticated = serializers.BooleanField()
    user = UserSerializer()


class SocialSignupRequiredResponseSerializer(serializers.Serializer):
    needsSignup = serializers.BooleanField()
    provider = serializers.CharField(required=False)
    provider_id = serializers.CharField(required=False)
    kakao_id = serializers.CharField(required=False)
    suggested_nickname = serializers.CharField(allow_blank=True)
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)
    email = serializers.EmailField(allow_blank=True, allow_null=True)
    signup_token = serializers.CharField()


SOCIAL_LOGIN_RESPONSE = PolymorphicProxySerializer(
    component_name='SocialLoginResponse',
    serializers=[TokenPairResponseSerializer, SocialSignupRequiredResponseSerializer],
    resource_type_field_name=None,
)


class LinkedSocialAccountSerializer(serializers.Serializer):
    provider = serializers.CharField()
    provider_display = serializers.CharField()
    email = serializers.EmailField(allow_blank=True, allow_null=True)
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)
    linked_at = serializers.DateTimeField()
    can_unlink = serializers.BooleanField()


class AuthenticationMethodsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    password = serializers.BooleanField()
    social_count = serializers.IntegerField()
    providers = serializers.ListField(child=serializers.CharField())
    can_remove_login_method = serializers.BooleanField()


class LinkedAccountsResponseSerializer(serializers.Serializer):
    has_password = serializers.BooleanField()
    email = serializers.EmailField(allow_blank=True, allow_null=True)
    primary_email = serializers.EmailField(allow_blank=True, allow_null=True)
    auth_methods = AuthenticationMethodsSerializer()
    linked_accounts = LinkedSocialAccountSerializer(many=True)


class OAuthLinkStateResponseSerializer(serializers.Serializer):
    state = serializers.CharField()


class PasswordUpdatedResponseSerializer(AccountSuccessMessageResponseSerializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class MergedAccountUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.CharField()
    email = serializers.EmailField(allow_blank=True, allow_null=True)
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)
    username = serializers.CharField(required=False)
    is_staff = serializers.BooleanField(required=False)
    email_verified = serializers.BooleanField(required=False)
    has_usable_password_flag = serializers.BooleanField(required=False)


class AccountMergeResponseSerializer(AccountSuccessMessageResponseSerializer):
    kept_user_id = serializers.IntegerField()
    deleted_user_id = serializers.IntegerField()
    access = serializers.CharField(required=False)
    refresh = serializers.CharField(required=False)
    user = MergedAccountUserSerializer(required=False)


class UserMessageResponseSerializer(AccountSuccessMessageResponseSerializer):
    user = UserSerializer()


class ValidResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()


class SessionBridgeIssueResponseSerializer(serializers.Serializer):
    code = serializers.UUIDField()


class ProfileUserResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    nickname = serializers.CharField()
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)
    email = serializers.EmailField(allow_blank=True, allow_null=True, required=False)
    is_staff = serializers.BooleanField(required=False)
    email_verified = serializers.BooleanField(required=False)
    has_usable_password_flag = serializers.BooleanField(required=False)


class UserProfileResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    user = ProfileUserResponseSerializer()
    bio = serializers.CharField(allow_blank=True)
    total_completed_days = serializers.IntegerField()
    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    joined_date = serializers.DateTimeField()
    is_public = serializers.BooleanField()
    followers_count = serializers.IntegerField()
    following_count = serializers.IntegerField()
    is_following = serializers.BooleanField()
    is_mutual_follow = serializers.BooleanField()


class ProfileDataSerializer(serializers.Serializer):
    profile = UserProfileResponseSerializer()


class ProfileResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = ProfileDataSerializer()


class FollowDataSerializer(serializers.Serializer):
    follow = FollowSerializer()


class FollowResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = FollowDataSerializer()


class UnfollowDataSerializer(serializers.Serializer):
    unfollowed_user_id = serializers.IntegerField()


class UnfollowResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = UnfollowDataSerializer()


class UserSearchResponseItemSerializer(UserSearchSerializer):
    is_following = serializers.BooleanField()
    total_completed_days = serializers.IntegerField()


class UserListDataSerializer(serializers.Serializer):
    users = UserSearchResponseItemSerializer(many=True)


class UserSearchResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = UserListDataSerializer()


class FollowersDataSerializer(serializers.Serializer):
    followers = UserSearchResponseItemSerializer(many=True)


class FollowersResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = FollowersDataSerializer()


class FollowingDataSerializer(serializers.Serializer):
    following = UserSearchResponseItemSerializer(many=True)


class FollowingResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = FollowingDataSerializer()


class FriendsDataSerializer(serializers.Serializer):
    friends = UserSearchResponseItemSerializer(many=True)


class FriendsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = FriendsDataSerializer()


class ProfileCalendarEntrySerializer(serializers.Serializer):
    date = serializers.DateField()
    is_completed = serializers.BooleanField()
    book = serializers.CharField()
    start_chapter = serializers.IntegerField()
    end_chapter = serializers.IntegerField()
    chapters = serializers.CharField()
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField()
    color = serializers.CharField()
    schedule_id = serializers.IntegerField()
    schedule_text = serializers.CharField()


class ProfileCalendarPlanSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    color = serializers.CharField()


class ProfileCalendarDataSerializer(serializers.Serializer):
    calendar = ProfileCalendarEntrySerializer(many=True)
    plans = ProfileCalendarPlanSerializer(many=True)


class ProfileCalendarResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = ProfileCalendarDataSerializer()


class AchievementResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True)
    achievement_type = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    icon = serializers.CharField()
    order = serializers.IntegerField()
    unlocked = serializers.BooleanField()
    unlockedAt = serializers.DateTimeField(allow_null=True)
    milestone_value = serializers.IntegerField()


class AchievementsDataSerializer(serializers.Serializer):
    achievements = AchievementResponseSerializer(many=True)


class AchievementsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = AchievementsDataSerializer()


class ReadingSettingsDataSerializer(serializers.Serializer):
    settings = ReadingSettingsSerializer()


class ReadingSettingsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    data = ReadingSettingsDataSerializer()


NOTIFICATION_SETTINGS_RESPONSE = NotificationSettingsSerializer
