from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as validate_django_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, UserProfile, Follow, UserAchievement, UserReadingSettings
from .email_identity import normalize_email_identity
from .visibility import live_user_filter
from todos.models import UserBibleProgress
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    is_staff = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'nickname', 'email', 'profile_image', 'is_staff', 'email_verified', 'has_usable_password_flag')
        read_only_fields = ('id', 'is_staff', 'email_verified', 'has_usable_password_flag')
        
    def get_is_staff(self, obj) -> bool:
        # superuser나 staff 권한이 있는 경우 admin으로 간주
        return obj.is_superuser or obj.is_staff


class PublicUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'nickname', 'profile_image')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'password', 'nickname')

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("이미 사용중인 아이디입니다.")
        return value

    def validate_nickname(self, value):
        if User.objects.filter(nickname=value).exists():
            raise serializers.ValidationError("이미 사용중인 닉네임입니다.")
        return value

    def validate_password(self, value):
        try:
            validate_django_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 숫자를 포함해야 합니다.")
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 문자를 포함해야 합니다.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            nickname=validated_data['nickname']
        )
        return user

class SocialLoginSerializer(serializers.Serializer):
    provider = serializers.CharField()  # 'kakao' or 'google'
    code = serializers.CharField(required=False, allow_blank=True)  # OAuth 인증 코드
    access_token = serializers.CharField(required=False, allow_blank=True)  # Native Kakao access token

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['nickname'] = user.nickname
        token['is_social'] = user.is_social
        token['token_version'] = user.token_version
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        logger.info("일반 로그인 성공: user_id=%s", self.user.id)
        return data 


class TokenPairResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer(allow_null=True)


class TokenRefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class UserProfileSerializer(serializers.ModelSerializer):
    """사용자 프로필 시리얼라이저"""
    user = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_mutual_follow = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'bio', 'total_completed_days',
            'current_streak', 'longest_streak', 'joined_date',
            'is_public', 'followers_count', 'following_count',
            'is_following', 'is_mutual_follow'
        ]
        read_only_fields = ['joined_date', 'total_completed_days', 'current_streak', 'longest_streak']
    
    def get_user(self, obj):
        serializer_class = self.context.get('user_serializer_class')
        if serializer_class is None:
            request = self.context.get('request')
            if request and request.user == obj.user:
                serializer_class = UserSerializer
            else:
                serializer_class = PublicUserSerializer
        return serializer_class(obj.user, context=self.context).data

    def _visible_related_users(self, queryset):
        request = self.context.get('request')
        visible_filter = Q(profile__is_public=True)
        if request and request.user.is_authenticated:
            visible_filter |= Q(id=request.user.id)
        return queryset.filter(live_user_filter()).filter(visible_filter)

    def get_followers_count(self, obj):
        return self._visible_related_users(
            User.objects.filter(following__following=obj.user)
        ).distinct().count()
    
    def get_following_count(self, obj):
        return self._visible_related_users(
            User.objects.filter(followers__follower=obj.user)
        ).distinct().count()
    
    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(
                follower=request.user,
                following=obj.user
            ).exists()
        return False
    
    def get_is_mutual_follow(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(
                follower=request.user,
                following=obj.user
            ).exists() and Follow.objects.filter(
                follower=obj.user,
                following=request.user
            ).exists()
        return False


class FollowSerializer(serializers.ModelSerializer):
    """팔로우 관계 시리얼라이저"""
    follower = PublicUserSerializer(read_only=True)
    following = PublicUserSerializer(read_only=True)
    
    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'created_at']
        read_only_fields = ['created_at']


class UserAchievementSerializer(serializers.ModelSerializer):
    """사용자 업적 시리얼라이저"""
    achievement_display = serializers.CharField(source='get_achievement_type_display', read_only=True)
    
    class Meta:
        model = UserAchievement
        fields = [
            'id', 'achievement_type', 'achievement_display',
            'achieved_at', 'milestone_value', 'details'
        ]
        read_only_fields = ['achieved_at']


class UserCalendarDataSerializer(serializers.Serializer):
    """사용자 달력 데이터 시리얼라이저"""
    date = serializers.DateField()
    is_completed = serializers.BooleanField()
    book = serializers.CharField()
    chapters = serializers.CharField()


class UserSearchSerializer(serializers.ModelSerializer):
    """사용자 검색 시리얼라이저"""
    is_following = serializers.SerializerMethodField()
    total_completed_days = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'nickname', 'profile_image', 'is_following', 'total_completed_days']
    
    def get_is_following(self, obj):
        # context에서 미리 계산된 following_ids가 있으면 사용 (N+1 방지)
        following_ids = self.context.get('following_ids')
        if following_ids is not None:
            return obj.id in following_ids

        # fallback: 직접 쿼리 (하위 호환)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(
                follower=request.user,
                following=obj
            ).exists()
        return False
    
    def get_total_completed_days(self, obj):
        try:
            return obj.profile.total_completed_days
        except AttributeError:
            return 0


# ========================================
# 이메일/비밀번호 인증 시리얼라이저
# ========================================

class EmailRegisterSerializer(serializers.Serializer):
    """이메일 회원가입 시리얼라이저"""
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    nickname = serializers.CharField(min_length=2, max_length=50)
    
    def validate_email(self, value):
        email = normalize_email_identity(value)
        if User.objects.filter(email__iexact=email, is_active=True).exists():
            raise serializers.ValidationError("이미 사용 중인 이메일입니다.")
        return email
    
    def validate_nickname(self, value):
        if User.objects.filter(nickname=value).exists():
            raise serializers.ValidationError("이미 사용 중인 닉네임입니다.")
        return value
    
    def validate_password(self, value):
        try:
            validate_django_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 숫자를 포함해야 합니다.")
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 문자를 포함해야 합니다.")
        return value
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "비밀번호가 일치하지 않습니다."})
        return data


class SetPasswordSerializer(serializers.Serializer):
    """비밀번호 설정/변경 시리얼라이저"""
    new_password = serializers.CharField(min_length=8, write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)
    current_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    
    def validate_new_password(self, value):
        try:
            validate_django_password(value, self.context.get('user'))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 숫자를 포함해야 합니다.")
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 문자를 포함해야 합니다.")
        return value
    
    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "비밀번호가 일치하지 않습니다."})
        user = self.context.get('user')
        if user and not user.has_password_set():
            raise serializers.ValidationError({
                "current_password": "비밀번호 재설정을 통해 먼저 본인 확인을 완료해주세요."
            })
        return data


class PasswordResetConfirmSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        try:
            validate_django_password(value, self.context.get('user'))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 숫자를 포함해야 합니다.")
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("비밀번호는 최소 1개의 문자를 포함해야 합니다.")
        return value


class LinkedAccountsSerializer(serializers.Serializer):
    """연결된 계정 목록 시리얼라이저"""
    has_password = serializers.BooleanField()
    email = serializers.EmailField(allow_null=True)
    linked_accounts = serializers.ListField(child=serializers.DictField())


class AccountEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    current_password = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate_email(self, value):
        email = normalize_email_identity(value)
        user = self.context['user']
        if User.objects.filter(email__iexact=email, is_active=True).exclude(id=user.id).exists():
            raise serializers.ValidationError("이미 사용 중인 이메일입니다.")
        return email

    def validate(self, data):
        user = self.context['user']
        if not user.has_password_set():
            raise serializers.ValidationError({
                "current_password": "비밀번호 설정 후 이메일을 변경할 수 있습니다."
            })
        current_password = data.get('current_password')
        if not current_password:
            raise serializers.ValidationError({"current_password": "현재 비밀번호를 입력해주세요."})
        if not user.check_password(current_password):
            raise serializers.ValidationError({"current_password": "현재 비밀번호가 올바르지 않습니다."})
        return data


class NotificationSettingsSerializer(serializers.Serializer):
    # Legacy notification-preference contract, backed by todos.NotificationSettings.
    # The four field names below are the shipped wire contract of
    # /api/v1/{auth,accounts}/notification-settings/ and are pinned by the
    # characterization golden and by schema.yml. They keep their original names,
    # help_text and required-ness; only the model underneath changed, because
    # todos.NotificationSettings is the model every sender actually reads.
    # See todos/migrations/0033. Kept as comments rather than a docstring because
    # drf-spectacular publishes docstrings as schema descriptions.

    FIELD_MAP = {
        'daily_reading_reminder': 'reading_reminders_enabled',
        'weekly_progress_summary': 'weekly_summary_enabled',
        'service_notice': 'service_notice_enabled',
        'reminder_time': 'reading_reminder_time',
    }

    daily_reading_reminder = serializers.BooleanField(
        required=False, help_text='매일 읽기 알림'
    )
    weekly_progress_summary = serializers.BooleanField(
        required=False, help_text='주간 진행 요약 알림'
    )
    service_notice = serializers.BooleanField(
        required=False, help_text='서비스 공지 알림'
    )
    reminder_time = serializers.TimeField(format='%H:%M', input_formats=['%H:%M'])

    def to_representation(self, instance):
        return {
            legacy_name: self.fields[legacy_name].to_representation(
                getattr(instance, canonical_name)
            )
            for legacy_name, canonical_name in self.FIELD_MAP.items()
        }

    def update(self, instance, validated_data):
        changed = [
            self.FIELD_MAP[legacy_name]
            for legacy_name in validated_data
            if legacy_name in self.FIELD_MAP
        ]
        for legacy_name, value in validated_data.items():
            setattr(instance, self.FIELD_MAP[legacy_name], value)
        if changed:
            instance.save(update_fields=[*changed, 'updated_at'])
        return instance


class ReadingSettingsSerializer(serializers.ModelSerializer):
    font_size = serializers.IntegerField(min_value=14, max_value=24)
    line_height = serializers.FloatField(min_value=1.4, max_value=2.4)

    class Meta:
        model = UserReadingSettings
        fields = [
            'theme',
            'font_family',
            'font_size',
            'font_weight',
            'line_height',
            'text_align',
            'verse_joining',
            'show_verse_numbers',
            'show_description',
            'show_cross_ref',
            'highlight_names',
            'show_footnotes',
            'tongdok_auto_complete',
        ]
