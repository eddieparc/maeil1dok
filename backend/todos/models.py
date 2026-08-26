import time as time_module

from django.db import IntegrityError, OperationalError, models, transaction
from django.utils import timezone
from django.conf import settings

from django.core.exceptions import ValidationError
from datetime import time

VISITOR_COUNT_INCREMENT_RETRY_DELAYS = (0, 0.02, 0.05, 0.1)

class BibleReadingPlan(models.Model):
    """성경 읽기 플랜"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    default_plan_identity = models.GeneratedField(
        expression=models.Case(
            models.When(is_default=True, then=models.Value(1)),
            default=models.Value(None),
            output_field=models.IntegerField(null=True),
        ),
        output_field=models.IntegerField(null=True),
        db_persist=True,
        unique=True,
        null=True,
        editable=False,
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # update_fields가 지정되면 해당 필드만 검증
        if 'update_fields' in kwargs and kwargs['update_fields']:
            # created_by 필드가 검증 대상에 포함되어 있지 않으면 전체 검증을 건너뜀
            if 'created_by' not in kwargs['update_fields']:
                super().save(*args, **kwargs)
                return
        
        # 일반적인 저장 로직
        # default_plan_identity는 DB에서 계산되는 GeneratedField이므로
        # 미저장 인스턴스에서는 읽을 수 없다. unique 보장은 DB 인덱스가 담당하므로
        # Python 측 검증에서는 제외한다.
        self.full_clean(exclude=['default_plan_identity'])
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class PlanSubscription(models.Model):
    """플랜 구독"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    plan = models.ForeignKey(BibleReadingPlan, on_delete=models.CASCADE)
    start_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'plan']

    def __str__(self):
        return f"{self.user.username}'s subscription to {self.plan.name}"

class DailyBibleSchedule(models.Model):
    """매일의 성경 읽기 스케줄"""
    plan = models.ForeignKey(
        BibleReadingPlan,
        on_delete=models.CASCADE,
        related_name='schedules',
    )
    date = models.DateField()
    book = models.CharField(max_length=50)
    start_chapter = models.IntegerField()
    end_chapter = models.IntegerField()
    audio_link = models.URLField(blank=True, null=True)
    guide_link = models.URLField(blank=True, null=True)
    
    class Meta:
        ordering = ['date']
        constraints = [
            models.UniqueConstraint(
                fields=['plan', 'date', 'book'],
                name='unique_schedule_per_plan_date_book',
            ),
        ]
        indexes = [
            models.Index(fields=['plan', 'date'], name='schedule_plan_date_idx'),
        ]

    def __str__(self):
        return f"{self.plan.name} - {self.date}: {self.book} {self.start_chapter}-{self.end_chapter}장"

    def clean(self):
        errors = {}

        if self.start_chapter is not None and self.start_chapter < 1:
            errors['start_chapter'] = '시작장은 1 이상이어야 합니다.'

        if self.end_chapter is not None and self.end_chapter < 1:
            errors['end_chapter'] = '끝장은 1 이상이어야 합니다.'

        if (
            self.start_chapter is not None
            and self.end_chapter is not None
            and self.start_chapter >= 1
            and self.end_chapter >= 1
            and self.end_chapter < self.start_chapter
        ):
            errors['end_chapter'] = '끝장은 시작장보다 작을 수 없습니다.'

        # 동일한 플랜, 날짜, 책 조합이 이미 존재하는지 확인
        exists = DailyBibleSchedule.objects.filter(
            plan=self.plan,
            date=self.date,
            book=self.book
        ).exclude(pk=self.pk).exists()

        if exists:
            errors['__all__'] = '동일한 플랜, 날짜, 책 조합의 스케줄이 이미 존재합니다.'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

class UserBibleProgress(models.Model):
    """사용자별 성경 읽기 진도"""
    subscription = models.ForeignKey(
        PlanSubscription,
        on_delete=models.CASCADE,
        related_name='progress',
    )
    schedule = models.ForeignKey(
        DailyBibleSchedule,
        on_delete=models.CASCADE,
        related_name='progress_records',
    )
    """사용자별 성경 읽기 진도"""
    is_completed = models.BooleanField(default=False)  # 완료 여부 명시적 표시
    completed_at = models.DateTimeField(null=True, blank=True)  # 완료 시점
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def mark_as_completed(self):
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()

    def mark_as_incomplete(self):
        self.is_completed = False
        self.completed_at = None
        self.save()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['subscription', 'schedule'],
                name='unique_progress_per_schedule',
            ),
        ]
        indexes = [
            models.Index(fields=['subscription', 'is_completed'], name='progress_sub_completed_idx'),
        ]

    @property
    def status(self):
        """해당 날짜의 진도 상태를 반환"""
        try:
            schedule = self.schedule
            if self.is_completed:
                return "completed"
            return "in_progress"
        except DailyBibleSchedule.DoesNotExist:
            return "no_schedule"

class VideoBibleIntro(models.Model):
    """성경 영상 개론 플랜"""
    plan = models.ForeignKey(
        BibleReadingPlan,
        on_delete=models.CASCADE,
        related_name='video_intros',
    )
    book = models.CharField(max_length=50, help_text="성경책 이름")
    url_link = models.URLField(help_text="영상 링크")
    start_date = models.DateField(help_text="시작일")
    end_date = models.DateField(help_text="종료일")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_date']
        constraints = [
            models.UniqueConstraint(
                fields=['plan', 'book'],
                name='unique_video_intro_per_book'
            )
        ]

    def clean(self):
        # 종료일이 시작일보다 이전인지 확인
        if self.end_date < self.start_date:
            raise ValidationError('종료일은 시작일보다 이후여야 합니다.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.plan.name} - {self.book} 개론 ({self.start_date} ~ {self.end_date})"


class UserVideoIntroProgress(models.Model):
    """사용자별 영상 개론 진행 상황"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    video_intro = models.ForeignKey(
        VideoBibleIntro,
        on_delete=models.CASCADE,
        related_name='user_progress'
    )
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'video_intro']

    def mark_as_completed(self):
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()

    def mark_as_incomplete(self):
        self.is_completed = False
        self.completed_at = None
        self.save()

    def __str__(self):
        status = "완료" if self.is_completed else "미완료"
        return f"{self.user.username}의 {self.video_intro.book} 개론 - {status}"


class HasenaRecord(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(help_text="기록 날짜")
    is_completed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username}의 하세나 기록 - {self.date}"


class HasenaSummary(models.Model):
    video_id = models.CharField(max_length=20, unique=True, db_index=True)
    video_date = models.DateField(null=True, blank=True, help_text="영상 날짜")
    title = models.CharField(max_length=200, blank=True, help_text="영상 제목")
    summary = models.TextField(help_text="AI 생성 요약")
    transcript = models.TextField(blank=True, help_text="원본 자막")
    model_used = models.CharField(max_length=50, default='gemini-3.5-flash')
    is_edited = models.BooleanField(default=False, help_text="관리자가 수정했는지 여부")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-video_date', '-created_at']
        verbose_name = '하세나 AI 요약'
        verbose_name_plural = '하세나 AI 요약'

    def __str__(self):
        date_str = self.video_date.strftime('%Y-%m-%d') if self.video_date else 'N/A'
        return f"[{date_str}] {self.video_id}"


class HasenaEntry(models.Model):
    date = models.DateField(unique=True, db_index=True, help_text="하세나 기준 날짜")
    video_id = models.CharField(max_length=20, db_index=True)
    title = models.CharField(max_length=200, blank=True)
    passage = models.CharField(max_length=120, blank=True, help_text="본문 범위")
    body_text = models.TextField(blank=True, help_text="파싱된 본문 텍스트")
    verses = models.JSONField(default=list, blank=True, help_text="절 단위 본문")
    source_url = models.URLField(blank=True)
    body_source_url = models.URLField(blank=True)
    fetched_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = '하세나 본문 캐시'
        verbose_name_plural = '하세나 본문 캐시'

    def __str__(self):
        return f"[{self.date}] {self.passage or self.video_id}"


class NotificationSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_settings',
    )
    notifications_enabled = models.BooleanField(default=True)
    reading_reminders_enabled = models.BooleanField(default=True)
    hasena_reminders_enabled = models.BooleanField(default=True)
    friend_activity_enabled = models.BooleanField(default=True)
    # Absorbed from accounts.UserReadingSettings (migration 0033). Nothing sends
    # on these yet; they exist so notification preferences have one owner.
    weekly_summary_enabled = models.BooleanField(default=False)
    service_notice_enabled = models.BooleanField(default=True)
    reading_reminder_time = models.TimeField(default=time(20, 0))
    hasena_reminder_time = models.TimeField(default=time(7, 0))
    timezone = models.CharField(max_length=64, default='Asia/Seoul')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['notifications_enabled', 'reading_reminders_enabled']),
            models.Index(fields=['notifications_enabled', 'hasena_reminders_enabled']),
            models.Index(fields=['notifications_enabled', 'friend_activity_enabled']),
        ]
        verbose_name = '알림 설정'
        verbose_name_plural = '알림 설정'

    def __str__(self):
        return f"{self.user.nickname} 알림 설정"


class NotificationPushSubscription(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_push_subscriptions',
    )
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=255, blank=True)
    enabled = models.BooleanField(default=True)
    failure_count = models.PositiveSmallIntegerField(default=0)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_failure_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'enabled']),
            models.Index(fields=['endpoint']),
        ]
        verbose_name = '푸시 알림 구독'
        verbose_name_plural = '푸시 알림 구독'

    def __str__(self):
        return f"{self.user.nickname} 푸시 구독"


class Notification(models.Model):
    TYPE_CHOICES = [
        ('reading_reminder', '통독 리마인더'),
        ('hasena_reminder', '하세나하시조 리마인더'),
        ('friend_activity', '친구 활동'),
        ('system', '시스템'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications',
    )
    type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    title = models.CharField(max_length=120)
    body = models.CharField(max_length=300)
    target_url = models.CharField(max_length=200, blank=True)
    data = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(max_length=160, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'read_at']),
            models.Index(fields=['dedupe_key']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['recipient', 'dedupe_key'],
                condition=~models.Q(dedupe_key=''),
                name='unique_notification_dedupe_per_user',
            ),
        ]
        verbose_name = '알림'
        verbose_name_plural = '알림'

    def mark_read(self):
        if self.read_at is None:
            self.read_at = timezone.now()
            self.save(update_fields=['read_at'])

    def __str__(self):
        return f"{self.recipient.nickname} - {self.title}"

class VisitorCount(models.Model):
    """일일 방문자 수 카운터"""
    date = models.DateField(unique=True)
    daily_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.date}: {self.daily_count} visitors"

    @classmethod
    def increment_daily_count(cls):
        """오늘의 방문자 수 증가"""
        today = timezone.now().date()
        for delay in VISITOR_COUNT_INCREMENT_RETRY_DELAYS:
            if delay:
                time_module.sleep(delay)
            try:
                with transaction.atomic():
                    visitor_count, _ = cls.objects.get_or_create(
                        date=today,
                        defaults={'daily_count': 0}
                    )
                    cls.objects.filter(id=visitor_count.id).update(
                        daily_count=models.F('daily_count') + 1
                    )
                    visitor_count.refresh_from_db()
                    return visitor_count
            except IntegrityError:
                continue
            except OperationalError as exc:
                if 'locked' not in str(exc).lower():
                    raise

        visitor_count = cls.objects.filter(date=today).first()
        if visitor_count:
            cls.objects.filter(id=visitor_count.id).update(
                daily_count=models.F('daily_count') + 1
            )
            visitor_count.refresh_from_db()
            return visitor_count
        raise OperationalError("Could not increment visitor count because the database stayed locked.")

    @classmethod
    def get_total_visitors(cls):
        """전체 누적 방문자 수 조회"""
        return cls.objects.aggregate(total=models.Sum('daily_count'))['total'] or 0


class ReadingGroup(models.Model):
    """성경 읽기 그룹/커뮤니티"""
    name = models.CharField(max_length=100, help_text="그룹 이름")
    description = models.TextField(blank=True, help_text="그룹 설명")
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_groups'
    )
    plans = models.ManyToManyField(
        BibleReadingPlan,
        related_name='reading_groups',
        help_text="그룹이 따르는 읽기 플랜들 (복수 선택 가능)"
    )
    is_public = models.BooleanField(default=False, help_text="공개 그룹 여부")
    max_members = models.IntegerField(
        default=50,
        help_text="최대 멤버 수 (1-10000)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_public']),
            models.Index(fields=['creator', '-created_at']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(max_members__gte=1, max_members__lte=10000),
                name='readinggroup_max_members_range',
            ),
        ]

    def __str__(self):
        plan_names = ", ".join([plan.name for plan in self.plans.all()[:2]])
        if self.plans.count() > 2:
            plan_names += f" 외 {self.plans.count() - 2}개"
        return f"{self.name} ({plan_names})" if plan_names else self.name

    @property
    def member_count(self):
        return self.memberships.filter(is_active=True).count()

    @property
    def is_full(self):
        return self.member_count >= self.max_members


class GroupMembership(models.Model):
    """그룹 멤버십"""
    ROLE_CHOICES = [
        ('admin', '관리자'),
        ('member', '멤버'),
    ]
    
    group = models.ForeignKey(
        ReadingGroup,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='member'
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    show_in_profile = models.BooleanField(
        default=True,
        help_text="프로필에 이 그룹 표시 여부"
    )

    class Meta:
        unique_together = ['group', 'user']
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['group', 'is_active']),
            models.Index(fields=['user', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.nickname} in {self.group.name} as {self.get_role_display()}"


class GroupInvitation(models.Model):
    """그룹 초대"""
    STATUS_CHOICES = [
        ('pending', '대기중'),
        ('accepted', '수락'),
        ('declined', '거절'),
        ('expired', '만료'),
    ]

    group = models.ForeignKey(
        ReadingGroup,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    inviter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_invitations'
    )
    invitee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_invitations'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    message = models.TextField(blank=True, help_text="초대 메시지")
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['group', 'invitee']
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation to {self.invitee.nickname} for {self.group.name}"


class UserPlanDisplaySettings(models.Model):
    """사용자별 플랜 표시 설정 (캘린더용)"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='plan_display_settings'
    )
    subscription = models.OneToOneField(
        PlanSubscription,
        on_delete=models.CASCADE,
        related_name='display_settings'
    )
    color = models.CharField(
        max_length=7,
        default='#3B82F6',
        help_text="플랜 표시 색상 (HEX)"
    )
    display_order = models.IntegerField(
        default=0,
        help_text="캘린더에서 표시 순서"
    )
    is_visible = models.BooleanField(
        default=True,
        help_text="캘린더에 표시 여부"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'created_at']
        indexes = [
            models.Index(fields=['user', 'is_visible']),
        ]
        verbose_name = "플랜 표시 설정"
        verbose_name_plural = "플랜 표시 설정"

    def __str__(self):
        return f"{self.user.nickname}'s display settings for {self.subscription.plan.name}"


class UserReadingPosition(models.Model):
    """사용자의 마지막 읽은 위치"""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reading_position'
    )
    book = models.CharField(max_length=10, help_text="성경책 코드 (gen, exo...)")
    chapter = models.IntegerField(help_text="장 번호")
    verse = models.IntegerField(null=True, blank=True, help_text="절 번호 (선택)")
    scroll_position = models.FloatField(default=0, help_text="스크롤 위치 (0-1)")
    version = models.CharField(max_length=10, default='GAE', help_text="역본")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "읽기 위치"
        verbose_name_plural = "읽기 위치"

    def __str__(self):
        return f"{self.user.nickname} - {self.book} {self.chapter}"


class BibleBookmark(models.Model):
    """성경 북마크"""
    BOOKMARK_TYPE_CHOICES = [
        ('chapter', '장'),
        ('verse', '절'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bible_bookmarks'
    )
    bookmark_type = models.CharField(max_length=10, choices=BOOKMARK_TYPE_CHOICES)
    book = models.CharField(max_length=10, help_text="성경책 코드")
    chapter = models.IntegerField()
    start_verse = models.IntegerField(null=True, blank=True, help_text="시작 절")
    end_verse = models.IntegerField(null=True, blank=True, help_text="끝 절")
    title = models.CharField(max_length=100, blank=True, help_text="북마크 제목")
    color = models.CharField(max_length=7, default='#3B82F6', help_text="표시 색상")
    memo = models.TextField(blank=True, help_text="간단한 메모")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'book', 'chapter']),
            models.Index(fields=['user', 'bookmark_type']),
        ]
        constraints = [
            # 장 북마크는 user, book, chapter 조합이 유일해야 함
            models.UniqueConstraint(
                fields=['user', 'book', 'chapter'],
                condition=models.Q(bookmark_type='chapter'),
                name='unique_chapter_bookmark'
            ),
            # 절 북마크는 user, book, chapter, start_verse, end_verse 조합이 유일해야 함
            models.UniqueConstraint(
                fields=['user', 'book', 'chapter', 'start_verse', 'end_verse'],
                condition=models.Q(bookmark_type='verse'),
                name='unique_verse_bookmark'
            ),
        ]
        verbose_name = "북마크"
        verbose_name_plural = "북마크"

    def __str__(self):
        if self.bookmark_type == 'verse':
            return f"{self.book} {self.chapter}:{self.start_verse}"
        return f"{self.book} {self.chapter}"


class ReflectionNote(models.Model):
    """성경 묵상노트"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reflection_notes'
    )
    book = models.CharField(max_length=10, help_text="성경책 코드")
    chapter = models.IntegerField()
    start_verse = models.IntegerField(null=True, blank=True)
    end_verse = models.IntegerField(null=True, blank=True)
    content = models.TextField(help_text="묵상 내용")
    is_private = models.BooleanField(default=True, help_text="비공개 여부")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'book', 'chapter']),
            models.Index(fields=['user', '-created_at']),
        ]
        verbose_name = "묵상노트"
        verbose_name_plural = "묵상노트"

    def __str__(self):
        return f"{self.user.nickname} - {self.book} {self.chapter}"


class BibleHighlight(models.Model):
    """구절 하이라이트 (형광펜)"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bible_highlights'
    )
    book = models.CharField(max_length=10, help_text="성경책 코드")
    chapter = models.IntegerField()
    start_verse = models.IntegerField()
    end_verse = models.IntegerField()
    color = models.CharField(max_length=7, default='#FEF3C7', help_text="하이라이트 색상 (HEX)")
    memo = models.TextField(blank=True, help_text="간단한 메모")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'book', 'chapter']),
            models.Index(fields=['user', '-created_at']),
        ]
        verbose_name = "하이라이트"
        verbose_name_plural = "하이라이트"

    def __str__(self):
        return f"{self.user.nickname} - {self.book} {self.chapter}:{self.start_verse}-{self.end_verse}"


class PersonalReadingRecord(models.Model):
    """개인 성경 읽기 기록 (Plan 무관)"""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='personal_reading_records'
    )
    book = models.CharField(max_length=10, help_text="성경책 코드")
    chapter = models.IntegerField()
    read_date = models.DateField(help_text="읽은 날짜")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'book', 'chapter']
        indexes = [
            models.Index(fields=['user', 'book']),
            models.Index(fields=['user', 'read_date']),
        ]
        verbose_name = "개인 읽기 기록"
        verbose_name_plural = "개인 읽기 기록"

    def __str__(self):
        return f"{self.user.nickname} - {self.book} {self.chapter}"


class CatchupSession(models.Model):
    """따라잡기 세션"""

    STRATEGY_CHOICES = [
        ('parallel', '동시 진행'),
        ('sequential', '순차 복귀'),
    ]

    STATUS_CHOICES = [
        ('active', '진행 중'),
        ('completed', '완료'),
        ('abandoned', '포기'),
    ]

    subscription = models.ForeignKey(
        PlanSubscription,
        on_delete=models.CASCADE,
        related_name='catchup_sessions',
        help_text="따라잡기 대상 구독"
    )
    active_subscription_identity = models.GeneratedField(
        expression=models.Case(
            models.When(status='active', then='subscription_id'),
            default=models.Value(None),
            output_field=models.IntegerField(null=True),
        ),
        output_field=models.IntegerField(null=True),
        db_persist=True,
        unique=True,
        null=True,
        editable=False,
    )
    name = models.CharField(
        max_length=100,
        help_text="사용자 지정 이름 (예: 나의 1월 도전!)"
    )

    # 따라잡기 범위
    range_start = models.DateField(help_text="밀린 기간 시작일")
    range_end = models.DateField(help_text="밀린 기간 종료일")

    # 전략 및 목표
    strategy = models.CharField(
        max_length=20,
        choices=STRATEGY_CHOICES,
        default='parallel',
        help_text="동시 진행: 원본과 함께 / 순차 복귀: 밀린 것부터 순서대로"
    )
    target_rejoin_date = models.DateField(
        null=True,
        blank=True,
        help_text="순차 복귀 모드에서 원본 플랜 합류 목표일"
    )

    # 읽기량 설정
    max_daily_readings = models.IntegerField(
        null=True,
        blank=True,
        help_text="하루 최대 읽기 횟수"
    )
    max_daily_chapters = models.IntegerField(
        null=True,
        blank=True,
        help_text="하루 최대 읽기 장 수"
    )
    weekend_multiplier = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        default=1.0,
        help_text="주말 읽기량 배수 (예: 1.5 = 평일의 1.5배)"
    )

    # 상태
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['subscription', 'status']),
        ]
        verbose_name = "따라잡기 세션"
        verbose_name_plural = "따라잡기 세션"

    def __str__(self):
        return f"{self.name} ({self.subscription.plan.name})"

    @property
    def progress_percentage(self):
        """진행률 계산"""
        total = self.schedules.count()
        if total == 0:
            return 0
        completed = self.schedules.filter(is_completed=True).count()
        return int((completed / total) * 100)

    @property
    def completed_count(self):
        """완료된 스케줄 수"""
        return self.schedules.filter(is_completed=True).count()

    @property
    def total_count(self):
        """전체 스케줄 수"""
        return self.schedules.count()

    @property
    def remaining_count(self):
        """남은 스케줄 수"""
        return self.schedules.filter(is_completed=False).count()


class CatchupSchedule(models.Model):
    """따라잡기 세션의 개별 스케줄"""

    session = models.ForeignKey(
        CatchupSession,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    original_schedule = models.ForeignKey(
        DailyBibleSchedule,
        on_delete=models.CASCADE,
        help_text="원본 스케줄 참조"
    )
    scheduled_date = models.DateField(
        help_text="새로 배정된 날짜"
    )

    # 완료 상태
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date', 'original_schedule__date']
        unique_together = ['session', 'original_schedule']
        indexes = [
            models.Index(fields=['session', 'scheduled_date']),
            models.Index(fields=['session', 'is_completed']),
        ]
        verbose_name = "따라잡기 스케줄"
        verbose_name_plural = "따라잡기 스케줄"

    def __str__(self):
        return f"{self.session.name} - {self.original_schedule.book} {self.original_schedule.start_chapter}-{self.original_schedule.end_chapter}장 ({self.scheduled_date})"

    def mark_as_completed(self):
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()

    def mark_as_incomplete(self):
        self.is_completed = False
        self.completed_at = None
        self.save()
