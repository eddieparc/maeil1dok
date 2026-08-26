"""Output-only serializers for function-based todos API responses."""

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_serializer
from rest_framework import serializers

from accounts.openapi_serializers import UserSearchResponseItemSerializer
from .notification_serializers import NotificationSerializer, NotificationSettingsSerializer
from .serializers import (
    BibleReadingPlanSerializer,
    CatchupScheduleSerializer,
    CatchupSessionSerializer,
    CatchupStatusSerializer,
    DailyBibleScheduleSerializer,
    PlanSubscriptionSerializer,
    UserPlanDisplaySettingsSerializer,
    UserReadingPositionSerializer,
    VideoBibleIntroSerializer,
)


class DetailResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()


class TodoSuccessMessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()


class SuccessCountResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    updated_count = serializers.IntegerField()


class CalendarSettingsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    settings = UserPlanDisplaySettingsSerializer(many=True)


class CalendarSettingResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    setting = UserPlanDisplaySettingsSerializer()


class CalendarItemSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField()
    subscription_id = serializers.IntegerField()
    color = serializers.CharField()
    book = serializers.CharField()
    chapters = serializers.CharField()
    is_completed = serializers.BooleanField()
    schedule_id = serializers.IntegerField()
    is_visible = serializers.BooleanField()


class CalendarMetaSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()


class CalendarMonthResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    calendar = serializers.DictField(
        child=serializers.ListField(child=CalendarItemSerializer())
    )
    settings = UserPlanDisplaySettingsSerializer(many=True)
    meta = CalendarMetaSerializer()


class LastIncompletePositionSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField()
    subscription_id = serializers.IntegerField()
    color = serializers.CharField()
    date = serializers.DateField()
    book = serializers.CharField()
    book_code = serializers.CharField()
    chapters = serializers.CharField()
    start_chapter = serializers.IntegerField()
    schedule_id = serializers.IntegerField()


class LastIncompletePositionsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    positions = LastIncompletePositionSerializer(many=True)


class CatchupPreviewSummarySerializer(serializers.Serializer):
    total_schedules = serializers.IntegerField(required=False)
    total_chapters = serializers.IntegerField(required=False)
    daily_average_readings = serializers.FloatField(required=False)
    daily_average_chapters = serializers.FloatField(required=False)
    estimated_days = serializers.IntegerField(required=False)
    rejoin_date = serializers.DateField(allow_null=True, required=False)


class CatchupPreviewItemSerializer(serializers.Serializer):
    original_date = serializers.DateField()
    book = serializers.CharField()
    start_chapter = serializers.IntegerField()
    end_chapter = serializers.IntegerField()


class CatchupPreviewDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    is_weekend = serializers.BooleanField()
    items = CatchupPreviewItemSerializer(many=True)
    total_chapters = serializers.IntegerField()


class CatchupPreviewResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    summary = CatchupPreviewSummarySerializer()
    preview_schedules = CatchupPreviewDaySerializer(many=True)
    warnings = serializers.ListField(child=serializers.CharField())


class CatchupSessionResponseSerializer(CatchupSessionSerializer):
    progress_percentage = serializers.IntegerField()
    completed_count = serializers.IntegerField()
    total_count = serializers.IntegerField()
    remaining_count = serializers.IntegerField()


class CatchupSuggestedSettingsSerializer(serializers.Serializer):
    max_daily_readings = serializers.IntegerField()
    estimated_days = serializers.IntegerField()
    estimated_rejoin_date = serializers.DateField()


class CatchupStatusResponseSerializer(CatchupStatusSerializer):
    active_catchup_session = CatchupSessionResponseSerializer(allow_null=True)
    suggested_settings = CatchupSuggestedSettingsSerializer()


class CatchupCelebrationStatsSerializer(serializers.Serializer):
    total_completed = serializers.IntegerField()
    total_chapters = serializers.IntegerField()
    days_taken = serializers.IntegerField()
    started_at = serializers.DateField(allow_null=True)
    completed_at = serializers.DateField(allow_null=True)


class CatchupCelebrationSerializer(serializers.Serializer):
    title = serializers.CharField()
    subtitle = serializers.CharField()
    stats = CatchupCelebrationStatsSerializer()


class CatchupCompleteResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    celebration = CatchupCelebrationSerializer()
    warning = serializers.CharField(allow_null=True, required=False)


class CatchupSessionScheduleDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    is_weekend = serializers.BooleanField()
    items = CatchupScheduleSerializer(many=True)


class CatchupSessionSchedulesResponseSerializer(serializers.Serializer):
    session = CatchupSessionResponseSerializer()
    schedules = CatchupSessionScheduleDaySerializer(many=True)


class CatchupProgressSerializer(serializers.Serializer):
    percentage = serializers.IntegerField()
    completed = serializers.IntegerField()
    total = serializers.IntegerField()


class CatchupScheduleToggleResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    is_completed = serializers.BooleanField()
    completed_at = serializers.DateTimeField(allow_null=True)
    session_progress = CatchupProgressSerializer()


class RecentReadingRecordSerializer(serializers.Serializer):
    book = serializers.CharField()
    chapter = serializers.IntegerField()
    read_date = serializers.DateField(allow_null=True)


class BibleHomeStatsResponseSerializer(serializers.Serializer):
    bookmarks = serializers.IntegerField()
    notes = serializers.IntegerField()
    highlights = serializers.IntegerField()
    recent_records = RecentReadingRecordSerializer(many=True)


class ReadingPositionResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    position = UserReadingPositionSerializer(allow_null=True)


class CertificationUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.CharField()


class CertificationPlanSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class CertificationPeriodSerializer(serializers.Serializer):
    startDate = serializers.DateField()
    endDate = serializers.DateField()


class CertificationProgressSerializer(serializers.Serializer):
    totalSchedules = serializers.IntegerField()
    completedSchedules = serializers.IntegerField()
    completionRate = serializers.FloatField()
    currentStreak = serializers.IntegerField()
    totalCompletedDays = serializers.IntegerField()
    latestCompletedAt = serializers.DateTimeField(allow_null=True)
    status = serializers.CharField()


class CertificationCardSerializer(serializers.Serializer):
    title = serializers.CharField()
    subtitle = serializers.CharField()
    readingRange = serializers.CharField()
    dateLabel = serializers.CharField()
    footer = serializers.CharField()


class CertificationProgressResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    user = CertificationUserSerializer()
    plan = CertificationPlanSerializer()
    period = CertificationPeriodSerializer()
    progress = CertificationProgressSerializer()
    card = CertificationCardSerializer()


class ChapterPlanDetailSerializer(serializers.Serializer):
    book = serializers.CharField()
    book_kor = serializers.CharField()
    book_unit_kor = serializers.CharField()
    start_chapter = serializers.IntegerField()
    end_chapter = serializers.IntegerField()
    schedule_id = serializers.IntegerField()
    date = serializers.DateField()
    is_complete = serializers.BooleanField()


class ChapterDetailResponseSerializer(serializers.Serializer):
    book = serializers.CharField()
    book_kor = serializers.CharField()
    book_unit_kor = serializers.CharField()
    chapter = serializers.CharField()
    is_logined = serializers.BooleanField()
    audio_link = serializers.URLField(allow_blank=True, allow_null=True, required=False)
    guide_link = serializers.URLField(allow_blank=True, allow_null=True, required=False)
    plan_id = serializers.IntegerField(required=False)
    plan_name = serializers.CharField(required=False)
    plan_date = serializers.DateField(required=False)
    is_complete = serializers.BooleanField(required=False)
    message = serializers.CharField(required=False)
    plan_detail = ChapterPlanDetailSerializer(many=True, required=False)


class TodayScheduleSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    book = serializers.CharField()
    book_code = serializers.CharField()
    start_chapter = serializers.IntegerField()
    end_chapter = serializers.IntegerField()
    audio_link = serializers.URLField(allow_blank=True, allow_null=True)
    guide_link = serializers.URLField(allow_blank=True, allow_null=True)
    is_completed = serializers.BooleanField()


class TodaySchedulesResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    schedules = TodayScheduleSerializer(many=True)


class AvailablePlansResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    plans = BibleReadingPlanSerializer(many=True)


class UserPlansResponseSerializer(serializers.Serializer):
    subscriptions = PlanSubscriptionSerializer(many=True)
    available_plans = BibleReadingPlanSerializer(many=True)


class PublicPlanSubscriptionSerializer(serializers.Serializer):
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField()
    is_default = serializers.BooleanField()


PLAN_SUBSCRIPTION_LIST_RESPONSE = PolymorphicProxySerializer(
    component_name='PlanSubscriptionListResponse',
    serializers=[PublicPlanSubscriptionSerializer, PlanSubscriptionSerializer],
    resource_type_field_name=None,
    many=True,
)


class ActiveResponseSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class ProgressUpdateResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    plan_id = serializers.CharField()
    schedule_ids = serializers.ListField(child=serializers.CharField())
    is_completed = serializers.BooleanField()


class NextReadingPositionResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    status = serializers.CharField()
    month = serializers.IntegerField(required=False)
    schedule_id = serializers.IntegerField(required=False)
    date = serializers.DateField(required=False)
    message = serializers.CharField(required=False)


class DailyBibleScheduleWithProgressSerializer(DailyBibleScheduleSerializer):
    is_completed = serializers.BooleanField(required=False)

    class Meta(DailyBibleScheduleSerializer.Meta):
        fields = [*DailyBibleScheduleSerializer.Meta.fields, 'is_completed']


class UserVideoIntroSerializer(VideoBibleIntroSerializer):
    is_completed = serializers.BooleanField()
    completed_at = serializers.DateTimeField(allow_null=True)

    class Meta(VideoBibleIntroSerializer.Meta):
        fields = [*VideoBibleIntroSerializer.Meta.fields, 'is_completed', 'completed_at']


class VideoIntroProgressResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    video_intro_id = serializers.IntegerField()
    is_completed = serializers.BooleanField()
    completed_at = serializers.DateTimeField(allow_null=True)


class UploadResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    errors = serializers.ListField(child=serializers.CharField(), allow_null=True, required=False)


class HasenaRecordListItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    date = serializers.DateField()
    is_completed = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class HasenaRecordResponseSerializer(HasenaRecordListItemSerializer):
    updated_at = serializers.DateTimeField()


class HasenaRecordUpdateResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = HasenaRecordResponseSerializer()


class HasenaStatusDataSerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True)
    date = serializers.DateField()
    is_completed = serializers.BooleanField()


class HasenaStatusResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = HasenaStatusDataSerializer()


class HasenaVerseSerializer(serializers.Serializer):
    number = serializers.CharField(required=False)
    verse = serializers.IntegerField(required=False)
    text = serializers.CharField()


class HasenaEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    date = serializers.DateField()
    passage = serializers.CharField()
    video_id = serializers.CharField()
    title = serializers.CharField()
    body_text = serializers.CharField()
    verses = HasenaVerseSerializer(many=True)
    source_url = serializers.URLField()
    body_source_url = serializers.URLField()
    fetched_at = serializers.DateTimeField(allow_null=True)


class HasenaDayResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    entry = HasenaEntrySerializer()
    is_completed = serializers.BooleanField()


class HasenaCalendarEntrySerializer(serializers.Serializer):
    date = serializers.DateField()
    passage = serializers.CharField()
    video_id = serializers.CharField()
    title = serializers.CharField()
    is_completed = serializers.BooleanField()


class HasenaCalendarResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    entries = HasenaCalendarEntrySerializer(many=True)


class HasenaSyncResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    synced = serializers.ListField(child=serializers.DateField())
    skipped = serializers.ListField(child=serializers.CharField())


class HasenaSummaryResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    video_id = serializers.CharField()
    summary = serializers.CharField()
    model = serializers.CharField()
    is_edited = serializers.BooleanField()
    video_date = serializers.DateField(allow_null=True)
    title = serializers.CharField(allow_blank=True)
    created = serializers.BooleanField(required=False)
    persisted = serializers.BooleanField()
    cacheable = serializers.BooleanField()


class HasenaSummaryPendingResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    status = serializers.CharField()
    reason = serializers.CharField()
    date = serializers.DateField()
    error = serializers.CharField()


class HasenaSummaryListItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    video_id = serializers.CharField()
    video_date = serializers.DateField(allow_null=True)
    title = serializers.CharField(allow_blank=True)
    summary_preview = serializers.CharField()
    is_edited = serializers.BooleanField()
    model_used = serializers.CharField()
    updated_at = serializers.DateTimeField()


class HasenaSummaryListResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    total = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    summaries = HasenaSummaryListItemSerializer(many=True)


class HasenaSummaryRegenerateResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    video_id = serializers.CharField()
    summary = serializers.CharField()
    model = serializers.CharField()


class HasenaSummaryUpdateResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    video_id = serializers.CharField()
    summary = serializers.CharField()
    title = serializers.CharField(allow_blank=True)
    is_edited = serializers.BooleanField()


class HasenaStatsDataSerializer(serializers.Serializer):
    total_completed = serializers.IntegerField()
    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()


class HasenaStatsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = HasenaStatsDataSerializer()


class TotalUsersResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    total_users = serializers.IntegerField()


class PlanStatsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    plan_name = serializers.CharField()
    today_completed_users = serializers.IntegerField()


class ProgressStatsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    plan_name = serializers.CharField()
    theoretical_progress = serializers.FloatField()
    user_progress = serializers.FloatField()


class PushConfigResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    enabled = serializers.BooleanField()
    vapid_public_key = serializers.CharField(allow_blank=True)


class PushSubscriptionResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    endpoint = serializers.URLField()
    enabled = serializers.BooleanField()


@extend_schema_serializer(component_name='TodoNotificationSettings')
class TodoNotificationSettingsSerializer(NotificationSettingsSerializer):
    pass


@extend_schema_serializer(component_name='TodoNotification')
class TodoNotificationSerializer(NotificationSerializer):
    actor_name = serializers.CharField(allow_null=True)
    is_read = serializers.BooleanField()
    target_url = serializers.CharField()


class NotificationSettingsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    settings = TodoNotificationSettingsSerializer()


class NotificationInboxResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    unread_count = serializers.IntegerField()
    notifications = TodoNotificationSerializer(many=True)
    settings = TodoNotificationSettingsSerializer()


class NotificationReadResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    notification = TodoNotificationSerializer()


class GroupCreatorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.CharField()
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)


class ReadingGroupResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    creator = GroupCreatorSerializer()
    plans = BibleReadingPlanSerializer(many=True)
    is_public = serializers.BooleanField()
    max_members = serializers.IntegerField()
    member_count = serializers.IntegerField()
    is_full = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    is_member = serializers.BooleanField()
    my_role = serializers.CharField(allow_null=True)
    show_in_profile = serializers.BooleanField()


class GroupResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    group = ReadingGroupResponseSerializer()


class GroupsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    groups = ReadingGroupResponseSerializer(many=True)
    total = serializers.IntegerField()


class GroupMutationResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()
    group = ReadingGroupResponseSerializer(required=False)


class GroupMemberSerializer(serializers.Serializer):
    user = UserSearchResponseItemSerializer()
    role = serializers.CharField()
    joined_at = serializers.DateTimeField()


class GroupMembersMetaSerializer(serializers.Serializer):
    total_members = serializers.IntegerField()
    offset = serializers.IntegerField()
    limit = serializers.IntegerField()
    returned_members = serializers.IntegerField()
    has_more = serializers.BooleanField()


class GroupMembersResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    members = GroupMemberSerializer(many=True)
    meta = GroupMembersMetaSerializer()


class GroupInvitationSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    group = ReadingGroupResponseSerializer()
    inviter = UserSearchResponseItemSerializer()
    message = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()


class InvitationsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    invitations = GroupInvitationSerializer(many=True)


class GroupVisibilityResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    show_in_profile = serializers.BooleanField()
    message = serializers.CharField()


class GroupProgressPlanSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class GroupProgressMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.CharField()
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)
    is_completed = serializers.BooleanField()


class GroupProgressScheduleSerializer(serializers.Serializer):
    book = serializers.CharField()
    start_chapter = serializers.IntegerField()
    end_chapter = serializers.IntegerField()


class GroupProgressDaySerializer(serializers.Serializer):
    schedule = GroupProgressScheduleSerializer()
    total_members = serializers.IntegerField()
    completed_count = serializers.IntegerField()
    members = GroupProgressMemberSerializer(many=True)


class GroupProgressMetaSerializer(GroupMembersMetaSerializer):
    year = serializers.IntegerField()
    month = serializers.IntegerField()


class GroupMemberProgressResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    plan = GroupProgressPlanSerializer()
    meta = GroupProgressMetaSerializer()
    calendar = serializers.DictField(child=GroupProgressDaySerializer())


class ScoreboardUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.CharField()
    profile_image = serializers.URLField(allow_blank=True, allow_null=True)
    is_me = serializers.BooleanField()
    role = serializers.CharField(required=False)


class LeaderboardEntrySerializer(serializers.Serializer):
    user = ScoreboardUserSerializer()
    completed_days = serializers.IntegerField()
    bible_completed_days = serializers.IntegerField()
    hasena_completed_days = serializers.IntegerField()
    activity_score = serializers.IntegerField()
    progress_rate = serializers.FloatField()
    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    current_hasena_streak = serializers.IntegerField()
    longest_hasena_streak = serializers.IntegerField()
    rank = serializers.IntegerField()
    joined_at = serializers.DateTimeField(required=False)


class ScoreboardResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    leaderboard = LeaderboardEntrySerializer(many=True)
    period = serializers.CharField()
    month = serializers.CharField(allow_null=True)
    plan_id = serializers.IntegerField(allow_null=True)


class FriendsScoreboardResponseSerializer(ScoreboardResponseSerializer):
    type = serializers.CharField()
    total_friends = serializers.IntegerField()


class GroupScoreboardGroupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    member_count = serializers.IntegerField()


class GroupScoreboardPlanSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)


class GroupScoreboardResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    group = GroupScoreboardGroupSerializer()
    plan = GroupScoreboardPlanSerializer()
    leaderboard = LeaderboardEntrySerializer(many=True)
    period = serializers.CharField()
    month = serializers.CharField(allow_null=True)


class RankingSerializer(serializers.Serializer):
    rank = serializers.IntegerField(allow_null=True)
    total_users = serializers.IntegerField()
    completed_days = serializers.IntegerField()
    bible_completed_days = serializers.IntegerField(required=False)
    hasena_completed_days = serializers.IntegerField(required=False)
    activity_score = serializers.IntegerField(required=False)
    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    percentile = serializers.FloatField()


class MyRankingResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    ranking = RankingSerializer()
    period = serializers.CharField()
    month = serializers.CharField(allow_null=True, required=False)
    plan_id = serializers.IntegerField(allow_null=True)
