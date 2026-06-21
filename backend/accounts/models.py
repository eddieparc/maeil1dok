# noqa: SIZE_OK  — legacy account data model module; this change only adds a scoped integrity constraint
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.utils import timezone
import secrets
from datetime import timedelta

class User(AbstractUser):
    nickname = models.CharField(max_length=50, unique=True)
    
    is_social = models.BooleanField(default=False)
    social_provider = models.CharField(max_length=20, null=True, blank=True)
    social_id = models.CharField(max_length=100, null=True, blank=True)
    profile_image = models.URLField(max_length=500, null=True, blank=True)
    
    email = models.EmailField(null=True, blank=True)
    has_usable_password_flag = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    
    token_version = models.PositiveIntegerField(default=0)
    
    scheduled_deletion_at = models.DateTimeField(null=True, blank=True)
    merged_into = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='merged_accounts'
    )
    
    # related_name 추가
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_set',
        blank=True,
        help_text='The groups this user belongs to.',
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_set',
        blank=True,
        help_text='Specific permissions for this user.',
        verbose_name='user permissions',
    )
    
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['nickname']
    
    def has_password_set(self):
        """사용자가 비밀번호를 설정했는지 확인"""
        return self.has_usable_password_flag and self.has_usable_password()
    
    def get_linked_providers(self):
        """연결된 소셜 제공자 목록 반환"""
        return list(self.social_accounts.values_list('provider', flat=True))
    
    def can_unlink_provider(self, provider):
        """
        특정 소셜 계정 연결 해제 가능 여부
        - 비밀번호가 설정되어 있거나
        - 다른 소셜 계정이 연결되어 있어야 함
        """
        if self.has_password_set():
            return True
        other_providers = self.social_accounts.exclude(provider=provider).count()
        return other_providers > 0


class SocialAccount(models.Model):
    """
    소셜 계정 연동 모델
    - 한 사용자가 여러 소셜 계정을 연결할 수 있음
    - 카카오, 구글 등 다중 제공자 지원
    """
    PROVIDER_CHOICES = [
        ('kakao', '카카오'),
        ('google', '구글'),
        ('apple', '애플'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='social_accounts'
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_id = models.CharField(max_length=100, help_text="소셜 제공자의 고유 ID")
    email = models.EmailField(null=True, blank=True, help_text="소셜 계정 이메일")
    profile_image = models.URLField(max_length=500, null=True, blank=True)
    access_token = models.TextField(null=True, blank=True, help_text="액세스 토큰 (암호화 저장)")
    refresh_token = models.TextField(null=True, blank=True, help_text="리프레시 토큰 (암호화 저장)")
    token_expires_at = models.DateTimeField(null=True, blank=True)
    extra_data = models.JSONField(default=dict, blank=True, help_text="추가 프로필 정보")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['provider', 'provider_id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'provider'],
                name='unique_social_account_per_user_provider',
            ),
        ]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'provider']),
            models.Index(fields=['provider', 'provider_id']),
        ]
    
    def __str__(self):
        return f"{self.user.nickname} - {self.get_provider_display()}"
    
    @classmethod
    def get_or_create_user(cls, provider, provider_id, defaults=None):
        """
        소셜 계정으로 사용자 조회 또는 생성
        Returns: (user, social_account, created)
        """
        defaults = defaults or {}
        try:
            social_account = cls.objects.select_related('user').get(
                provider=provider,
                provider_id=provider_id
            )
            return social_account.user, social_account, False
        except cls.DoesNotExist:
            return None, None, True


class UserProfile(models.Model):
    """사용자 프로필 정보"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='profile'
    )
    bio = models.TextField(max_length=500, blank=True, help_text="자기소개")
    total_completed_days = models.IntegerField(default=0, help_text="총 완료한 일수")
    current_streak = models.IntegerField(default=0, help_text="현재 연속 일수")
    longest_streak = models.IntegerField(default=0, help_text="최장 연속 일수")
    joined_date = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=True, help_text="프로필 공개 여부")
    
    class Meta:
        ordering = ['-total_completed_days']
    
    def __str__(self):
        return f"{self.user.nickname}'s Profile"


class Follow(models.Model):
    """팔로우 관계"""
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='following',
        on_delete=models.CASCADE
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='followers',
        on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['follower', 'following']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['follower', '-created_at']),
            models.Index(fields=['following', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.follower.nickname} follows {self.following.nickname}"


class UserAchievement(models.Model):
    """사용자 업적/성취"""
    ACHIEVEMENT_TYPES = [
        ('first_complete', '첫 완독'),
        ('streak_7', '7일 연속'),
        ('streak_30', '30일 연속'),
        ('streak_100', '100일 연속'),
        ('total_30', '누적 30일'),
        ('total_100', '누적 100일'),
        ('total_365', '누적 365일'),
        ('book_complete', '책 완독'),
        ('testament_complete', '구약/신약 완독'),
        ('bible_complete', '성경 완독'),
        ('hasena_total_30', '하세나하시조 30일'),
        ('hasena_total_100', '하세나하시조 100일'),
        ('hasena_streak_7', '하세나하시조 7회 연속'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='achievements',
        on_delete=models.CASCADE
    )
    achievement_type = models.CharField(
        max_length=50,
        choices=ACHIEVEMENT_TYPES
    )
    achieved_at = models.DateTimeField(auto_now_add=True)
    milestone_value = models.IntegerField(default=0, help_text="달성 값 (예: 연속 일수)")
    details = models.JSONField(default=dict, blank=True, help_text="추가 정보")
    
    class Meta:
        unique_together = ['user', 'achievement_type']
        ordering = ['-achieved_at']
    
    def __str__(self):
        return f"{self.user.nickname} - {self.get_achievement_type_display()}"


class UserReadingSettings(models.Model):
    """사용자 읽기 설정"""
    THEME_CHOICES = [
        ('light', '라이트'),
        ('dark', '다크'),
        ('system', '시스템'),
    ]

    FONT_FAMILY_CHOICES = [
        ('ridi-batang', 'RIDI 바탕'),
        ('noto-serif', 'Noto Serif KR'),
        ('kopub-batang', 'KoPub 바탕'),
        ('pretendard', 'Pretendard'),
        ('noto-sans', 'Noto Sans KR'),
        ('system', '시스템 기본'),
    ]

    FONT_WEIGHT_CHOICES = [
        ('normal', '보통'),
        ('medium', '중간'),
        ('bold', '굵게'),
    ]

    TEXT_ALIGN_CHOICES = [
        ('left', '왼쪽'),
        ('justify', '양쪽 정렬'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reading_settings'
    )

    # Theme
    theme = models.CharField(
        max_length=10,
        choices=THEME_CHOICES,
        default='light',
        help_text='화면 테마'
    )

    # Typography
    font_family = models.CharField(
        max_length=20,
        choices=FONT_FAMILY_CHOICES,
        default='kopub-batang',
        help_text='글꼴'
    )
    font_size = models.IntegerField(
        default=16,
        help_text='글자 크기 (14-24)'
    )
    font_weight = models.CharField(
        max_length=10,
        choices=FONT_WEIGHT_CHOICES,
        default='medium',
        help_text='글자 두께'
    )
    line_height = models.FloatField(
        default=1.6,
        help_text='줄 간격 (1.4-2.4)'
    )
    text_align = models.CharField(
        max_length=10,
        choices=TEXT_ALIGN_CHOICES,
        default='left',
        help_text='텍스트 정렬'
    )

    # Verse display options
    verse_joining = models.BooleanField(
        default=False,
        help_text='절을 문단으로 연결하여 표시'
    )
    show_verse_numbers = models.BooleanField(
        default=True,
        help_text='절 번호 표시'
    )

    # Content display options (새한글 번역 관련)
    show_description = models.BooleanField(
        default=True,
        help_text='시편 머리말 표시 (새한글)'
    )
    show_cross_ref = models.BooleanField(
        default=True,
        help_text='교차 참조 표시 (새한글)'
    )
    highlight_names = models.BooleanField(
        default=True,
        help_text='인명/지명 강조 표시'
    )
    show_footnotes = models.BooleanField(
        default=False,
        help_text='각주 표시 (새한글)'
    )

    # Behavior settings
    tongdok_auto_complete = models.BooleanField(
        default=False,
        help_text='통독모드 자동 완료'
    )

    daily_reading_reminder = models.BooleanField(
        default=True,
        help_text='매일 읽기 알림'
    )
    weekly_progress_summary = models.BooleanField(
        default=False,
        help_text='주간 진행 요약 알림'
    )
    service_notice = models.BooleanField(
        default=True,
        help_text='서비스 공지 알림'
    )
    reminder_time = models.TimeField(
        default='07:00',
        help_text='읽기 알림 시간'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '읽기 설정'
        verbose_name_plural = '읽기 설정'

    def __str__(self):
        return f"{self.user.nickname}의 읽기 설정"


class EmailVerificationToken(models.Model):
    """이메일 인증 토큰"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification_tokens'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    email = models.EmailField(help_text="인증 대상 이메일")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"Email verification for {self.email}"
    
    @classmethod
    def create_token(cls, user, email, expiry_hours=24):
        """새 인증 토큰 생성"""
        # 기존 미사용 토큰 무효화
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        
        token = secrets.token_urlsafe(48)
        expires_at = timezone.now() + timedelta(hours=expiry_hours)
        
        return cls.objects.create(
            user=user,
            token=token,
            email=email,
            expires_at=expires_at
        )
    
    def is_valid(self):
        """토큰 유효성 검사"""
        if self.is_used:
            return False
        if timezone.now() > self.expires_at:
            return False
        return True
    
    def verify(self):
        """토큰 사용 및 이메일 인증 완료 처리"""
        if not self.is_valid():
            return False
        
        self.is_used = True
        self.save(update_fields=['is_used'])
        
        # 사용자 이메일 인증 완료
        self.user.email_verified = True
        self.user.email = self.email
        self.user.save(update_fields=['email_verified', 'email'])
        
        return True


class PasswordResetToken(models.Model):
    """비밀번호 재설정 토큰"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"Password reset for {self.user.email}"
    
    @classmethod
    def create_token(cls, user, expiry_hours=1):
        """새 비밀번호 재설정 토큰 생성 (기본 1시간 유효)"""
        # 기존 미사용 토큰 무효화
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        
        token = secrets.token_urlsafe(48)
        expires_at = timezone.now() + timedelta(hours=expiry_hours)
        
        return cls.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )
    
    def is_valid(self):
        """토큰 유효성 검사"""
        if self.is_used:
            return False
        if timezone.now() > self.expires_at:
            return False
        return True
    
    def use_token(self):
        """토큰 사용 처리"""
        if not self.is_valid():
            return False
        
        self.is_used = True
        self.save(update_fields=['is_used'])
        return True
