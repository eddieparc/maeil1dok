from datetime import date
from decimal import Decimal

from rest_framework import serializers
from .models import (
    DailyBibleSchedule, BibleReadingPlan,
    PlanSubscription, VideoBibleIntro, UserPlanDisplaySettings,
    CatchupSession, CatchupSchedule,
    UserReadingPosition, BibleBookmark, ReflectionNote, BibleHighlight, PersonalReadingRecord,
    HasenaRecord,
)
from django.contrib.auth import get_user_model
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError

class DailyBibleScheduleSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    
    class Meta:
        model = DailyBibleSchedule
        fields = [
            'id', 'plan', 'plan_name', 'date', 'book',
            'start_chapter', 'end_chapter', 'audio_link', 'guide_link',
        ]
    def validate(self, attrs):
        attrs = super().validate(attrs)
        start_chapter = attrs.get('start_chapter', getattr(self.instance, 'start_chapter', None))
        end_chapter = attrs.get('end_chapter', getattr(self.instance, 'end_chapter', None))
        errors = {}

        if start_chapter is not None and start_chapter < 1:
            errors['start_chapter'] = '시작장은 1 이상이어야 합니다.'

        if end_chapter is not None and end_chapter < 1:
            errors['end_chapter'] = '끝장은 1 이상이어야 합니다.'

        if (
            start_chapter is not None
            and end_chapter is not None
            and start_chapter >= 1
            and end_chapter >= 1
            and end_chapter < start_chapter
        ):
            errors['end_chapter'] = '끝장은 시작장보다 작을 수 없습니다.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs
        
    def validate_audio_link(self, value):
        # None 값 처리
        if value is None:
            return ''
        
        # float 타입이면 문자열로 변환
        if isinstance(value, float):
            # NaN 체크
            import math
            if math.isnan(value):
                return ''
            # 소수점 없는 정수형 숫자로 보이면 정수로 변환
            if value.is_integer():
                value = str(int(value))
            else:
                value = str(value)
        
        # 문자열 타입이 아니면 문자열로 변환
        if not isinstance(value, str):
            value = str(value)
        
        # 빈 문자열은 그대로 통과
        value = value.strip()
        if value == '':
            return ''
        
        # URL 형식 검증
        try:
            URLValidator()(value)
        except ValidationError:
            # URL 형식이 아니면서 http:// 또는 https://로 시작하지 않으면 https:// 추가
            if not value.startswith(('http://', 'https://')):
                value = 'https://' + value
                # 다시 유효성 검사
                try:
                    URLValidator()(value)
                except ValidationError:
                    raise serializers.ValidationError("유효한 URL을 입력하세요.")
        return value
        
    def validate_guide_link(self, value):
        # audio_link와 동일한 로직 적용
        # None 값 처리
        if value is None:
            return ''
        
        # float 타입이면 문자열로 변환
        if isinstance(value, float):
            # NaN 체크
            import math
            if math.isnan(value):
                return ''
            # 소수점 없는 정수형 숫자로 보이면 정수로 변환
            if value.is_integer():
                value = str(int(value))
            else:
                value = str(value)
        
        # 문자열 타입이 아니면 문자열로 변환
        if not isinstance(value, str):
            value = str(value)
        
        # 빈 문자열은 그대로 통과
        value = value.strip()
        if value == '':
            return ''
        
        # URL 형식 검증
        try:
            URLValidator()(value)
        except ValidationError:
            if not value.startswith(('http://', 'https://')):
                value = 'https://' + value
                try:
                    URLValidator()(value)
                except ValidationError:
                    raise serializers.ValidationError("유효한 URL을 입력하세요.")
        return value

class BibleProgressResponse(serializers.Serializer):
    status = serializers.CharField()  # completed, not_started
    section = serializers.SerializerMethodField()

    def get_section(self, obj):
        if not obj.get('section'):
            return None

        return {
            'date': obj['section'].date,
            'book': obj['section'].book,
            'start_chapter': obj['section'].start_chapter,
            'end_chapter': obj['section'].end_chapter,
            'is_completed': obj.get('is_completed', False)
        }


class BibleReadingPlanSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()
    subscriber_count = serializers.IntegerField(read_only=True, default=0)
    
    class Meta:
        model = BibleReadingPlan
        fields = [
            'id', 'name', 'description', 'is_default', 'is_active',
            'created_by', 'created_by_username', 'subscriber_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_by_username', 'subscriber_count']
    
    def get_created_by_username(self, obj) -> str:
        # N+1 방지를 위해 created_by를 select_related로 가져오세요.
        if obj.created_by:
            return obj.created_by.username
        return None
    
    def get_subscriber_count(self, obj):
        if hasattr(obj, 'subscriber_count'):
            return obj.subscriber_count
        return obj.plansubscription_set.filter(is_active=True).count()

class PlanSubscriptionSerializer(serializers.ModelSerializer):
    plan_id = serializers.IntegerField(source='plan.id', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    is_default = serializers.BooleanField(source='plan.is_default', read_only=True)
    
    class Meta:
        model = PlanSubscription
        fields = [
            'id', 'plan_id', 'plan_name', 
            'is_active', 'is_default', 'start_date'
        ]
        read_only_fields = ['id', 'plan_id', 'plan_name', 'is_default', 'start_date']


class PlanSubscriptionUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanSubscription
        fields = ['is_active']

    def validate_is_active(self, value):
        if self.instance and self.instance.plan.is_default and value is False:
            raise serializers.ValidationError("기본 플랜 구독은 비활성화할 수 없습니다.")
        if self.instance and value is True and not self.instance.plan.is_active:
            raise serializers.ValidationError("현재 신규 구독이 중단된 플랜은 다시 활성화할 수 없습니다.")
        return value

class VideoBibleIntroSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)

    class Meta:
        model = VideoBibleIntro
        fields = ['id', 'plan', 'plan_name', 'book', 'url_link', 'start_date', 'end_date']
        read_only_fields = ['id']


class UserPlanDisplaySettingsSerializer(serializers.ModelSerializer):
    """사용자 플랜 표시 설정 Serializer"""
    subscription_id = serializers.IntegerField(source='subscription.id', read_only=True)
    plan_id = serializers.IntegerField(source='subscription.plan.id', read_only=True)
    plan_name = serializers.CharField(source='subscription.plan.name', read_only=True)
    is_active = serializers.BooleanField(source='subscription.is_active', read_only=True)

    class Meta:
        model = UserPlanDisplaySettings
        fields = [
            'id', 'subscription_id', 'plan_id', 'plan_name',
            'color', 'display_order', 'is_visible', 'is_active'
        ]
        read_only_fields = ['id', 'subscription_id', 'plan_id', 'plan_name', 'is_active']


class CalendarSettingUpdateSerializer(serializers.ModelSerializer):
    """캘린더 표시 설정 변경 Serializer"""

    color = serializers.RegexField(
        regex=r'^#[0-9A-Fa-f]{6}$',
        required=False,
        error_messages={'invalid': '색상은 #RRGGBB 형식이어야 합니다.'},
    )
    is_visible = serializers.BooleanField(required=False)

    class Meta:
        model = UserPlanDisplaySettings
        fields = ['color', 'is_visible']


class CalendarSettingReorderItemSerializer(serializers.Serializer):
    """캘린더 표시 순서 변경 항목 Serializer"""

    id = serializers.IntegerField(min_value=1)
    display_order = serializers.IntegerField(min_value=0, max_value=1000)


class CalendarMonthQuerySerializer(serializers.Serializer):
    """월별 캘린더 조회 쿼리 Serializer"""

    year = serializers.IntegerField(min_value=1, max_value=9999, required=False)
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)

    def validate(self, attrs):
        has_year = 'year' in attrs
        has_month = 'month' in attrs
        if has_year != has_month:
            raise serializers.ValidationError("year와 month는 함께 입력해야 합니다.")
        return attrs


class HasenaRecordListQuerySerializer(serializers.Serializer):
    """하세나 기록 목록 조회 쿼리 Serializer"""

    year = serializers.IntegerField(min_value=1, max_value=9999, required=False)
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)


class CalendarDayScheduleSerializer(serializers.Serializer):
    """캘린더 날짜별 스케줄 Serializer"""
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField()
    color = serializers.CharField()
    book = serializers.CharField()
    chapters = serializers.CharField()
    is_completed = serializers.BooleanField()
    schedule_id = serializers.IntegerField(required=False)


class LastIncompletePositionSerializer(serializers.Serializer):
    """마지막 미완료 위치 Serializer"""
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField()
    subscription_id = serializers.IntegerField()
    date = serializers.DateField()
    book = serializers.CharField()
    chapters = serializers.CharField()


# ==================== Catchup Serializers ====================

class OverdueScheduleSerializer(serializers.ModelSerializer):
    """밀린 스케줄 Serializer"""
    class Meta:
        model = DailyBibleSchedule
        fields = ['id', 'date', 'book', 'start_chapter', 'end_chapter']


class CatchupSessionSerializer(serializers.ModelSerializer):
    """따라잡기 세션 Serializer"""
    progress_percentage = serializers.ReadOnlyField()
    completed_count = serializers.ReadOnlyField()
    total_count = serializers.ReadOnlyField()
    remaining_count = serializers.ReadOnlyField()
    plan_name = serializers.CharField(source='subscription.plan.name', read_only=True)

    class Meta:
        model = CatchupSession
        fields = [
            'id', 'name', 'subscription', 'plan_name',
            'range_start', 'range_end',
            'strategy', 'target_rejoin_date',
            'max_daily_readings', 'max_daily_chapters', 'weekend_multiplier',
            'status', 'completed_at',
            'progress_percentage', 'completed_count', 'total_count', 'remaining_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['subscription', 'status', 'completed_at', 'created_at', 'updated_at']


class CatchupStatusSerializer(serializers.Serializer):
    """밀린 현황 응답 Serializer"""
    has_overdue = serializers.BooleanField()
    overdue_count = serializers.IntegerField()
    overdue_chapters = serializers.IntegerField()
    overdue_range = serializers.DictField(child=serializers.DateField(), allow_null=True)
    overdue_schedules = OverdueScheduleSerializer(many=True)
    active_catchup_session = serializers.SerializerMethodField()
    suggested_settings = serializers.DictField()

    def get_active_catchup_session(self, obj):
        session = obj.get('active_catchup_session')
        if session:
            return CatchupSessionSerializer(session).data
        return None


class CatchupPreviewRequestSerializer(serializers.Serializer):
    """따라잡기 미리보기 요청 Serializer"""
    range_start = serializers.DateField(required=False)
    range_end = serializers.DateField(required=False)
    strategy = serializers.ChoiceField(
        choices=['parallel', 'sequential'],
        default='parallel'
    )
    max_daily_readings = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    max_daily_chapters = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    weekend_multiplier = serializers.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('1.0'),
        min_value=Decimal('0.5'), max_value=Decimal('3.0')
    )
    target_rejoin_date = serializers.DateField(required=False, allow_null=True)


class CatchupSessionPlanningSerializer(serializers.ModelSerializer):
    max_daily_readings = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    max_daily_chapters = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    weekend_multiplier = serializers.DecimalField(
        max_digits=3, decimal_places=1, required=False,
        min_value=Decimal('0.5'), max_value=Decimal('3.0')
    )

    def validate(self, data):
        range_start = data.get('range_start') or getattr(self.instance, 'range_start', None)
        range_end = data.get('range_end') or getattr(self.instance, 'range_end', None)
        if range_end and range_start and range_end < range_start:
            raise serializers.ValidationError({
                'range_end': '종료일은 시작일 이후여야 합니다.'
            })
        return data


class CatchupSessionCreateSerializer(CatchupSessionPlanningSerializer):
    """따라잡기 세션 생성 Serializer"""

    class Meta:
        model = CatchupSession
        fields = [
            'name', 'range_start', 'range_end',
            'strategy', 'target_rejoin_date',
            'max_daily_readings', 'max_daily_chapters', 'weekend_multiplier'
        ]


class CatchupSessionUpdateSerializer(CatchupSessionPlanningSerializer):
    """따라잡기 세션 수정 Serializer"""

    class Meta:
        model = CatchupSession
        fields = [
            'name', 'target_rejoin_date',
            'max_daily_readings', 'max_daily_chapters', 'weekend_multiplier'
        ]


class CatchupSessionSchedulesQuerySerializer(serializers.Serializer):
    """따라잡기 스케줄 목록 쿼리 Serializer"""
    date = serializers.DateField(required=False)

    def validate(self, attrs):
        if self.initial_data.get('date') == '':
            raise serializers.ValidationError({'date': 'Date has wrong format.'})
        return attrs


class CatchupScheduleSerializer(serializers.ModelSerializer):
    """따라잡기 스케줄 Serializer"""
    book = serializers.CharField(source='original_schedule.book', read_only=True)
    start_chapter = serializers.IntegerField(source='original_schedule.start_chapter', read_only=True)
    end_chapter = serializers.IntegerField(source='original_schedule.end_chapter', read_only=True)
    original_date = serializers.DateField(source='original_schedule.date', read_only=True)
    audio_link = serializers.URLField(source='original_schedule.audio_link', read_only=True, allow_null=True)
    guide_link = serializers.URLField(source='original_schedule.guide_link', read_only=True, allow_null=True)

    class Meta:
        model = CatchupSchedule
        fields = [
            'id', 'session', 'scheduled_date',
            'book', 'start_chapter', 'end_chapter', 'original_date',
            'audio_link', 'guide_link',
            'is_completed', 'completed_at'
        ]
        read_only_fields = ['session', 'completed_at']


class CatchupCompleteResponseSerializer(serializers.Serializer):
    """따라잡기 완료 응답 Serializer"""
    success = serializers.BooleanField()
    message = serializers.CharField()
    celebration = serializers.DictField()
    warning = serializers.CharField(allow_null=True, required=False)


# ==================== 성경읽기 기능 Serializers ====================

# 성경책 코드 -> 한글명 매핑
BIBLE_BOOKS_KOR = {
    'gen': '창세기', 'exo': '출애굽기', 'lev': '레위기', 'num': '민수기', 'deu': '신명기',
    'jos': '여호수아', 'jdg': '사사기', 'rut': '룻기', '1sa': '사무엘상', '2sa': '사무엘하',
    '1ki': '열왕기상', '2ki': '열왕기하', '1ch': '역대상', '2ch': '역대하', 'ezr': '에스라',
    'neh': '느헤미야', 'est': '에스더', 'job': '욥기', 'psa': '시편', 'pro': '잠언',
    'ecc': '전도서', 'sng': '아가', 'isa': '이사야', 'jer': '예레미야', 'lam': '예레미야애가',
    'ezk': '에스겔', 'dan': '다니엘', 'hos': '호세아', 'jol': '요엘', 'amo': '아모스',
    'oba': '오바댜', 'jon': '요나', 'mic': '미가', 'nam': '나훔', 'hab': '하박국',
    'zep': '스바냐', 'hag': '학개', 'zec': '스가랴', 'mal': '말라기',
    'mat': '마태복음', 'mrk': '마가복음', 'luk': '누가복음', 'jhn': '요한복음', 'act': '사도행전',
    'rom': '로마서', '1co': '고린도전서', '2co': '고린도후서', 'gal': '갈라디아서', 'eph': '에베소서',
    'php': '빌립보서', 'col': '골로새서', '1th': '데살로니가전서', '2th': '데살로니가후서',
    '1ti': '디모데전서', '2ti': '디모데후서', 'tit': '디도서', 'phm': '빌레몬서', 'heb': '히브리서',
    'jas': '야고보서', '1pe': '베드로전서', '2pe': '베드로후서', '1jn': '요한일서',
    '2jn': '요한이서', '3jn': '요한삼서', 'jud': '유다서', 'rev': '요한계시록',
    # 요나서 코드 별칭: fetch 레이어는 'jnh', 일부 프론트는 'jon'을 사용하므로 둘 다 인식
    'jnh': '요나',
}

BIBLE_BOOK_CHAPTERS = {
    'gen': 50, 'exo': 40, 'lev': 27, 'num': 36, 'deu': 34,
    'jos': 24, 'jdg': 21, 'rut': 4, '1sa': 31, '2sa': 24,
    '1ki': 22, '2ki': 25, '1ch': 29, '2ch': 36, 'ezr': 10,
    'neh': 13, 'est': 10, 'job': 42, 'psa': 150, 'pro': 31,
    'ecc': 12, 'sng': 8, 'isa': 66, 'jer': 52, 'lam': 5,
    'ezk': 48, 'dan': 12, 'hos': 14, 'jol': 3, 'amo': 9,
    'oba': 1, 'jnh': 4, 'mic': 7, 'nam': 3, 'hab': 3,
    'zep': 3, 'hag': 2, 'zec': 14, 'mal': 4,
    'mat': 28, 'mrk': 16, 'luk': 24, 'jhn': 21, 'act': 28,
    'rom': 16, '1co': 16, '2co': 13, 'gal': 6, 'eph': 6,
    'php': 4, 'col': 4, '1th': 5, '2th': 3,
    '1ti': 6, '2ti': 4, 'tit': 3, 'phm': 1, 'heb': 13,
    'jas': 5, '1pe': 5, '2pe': 3, '1jn': 5,
    '2jn': 1, '3jn': 1, 'jud': 1, 'rev': 22,
}

SUPPORTED_READING_VERSIONS = frozenset({
    'GAE', 'KNT', 'WOORI', 'SAENEW', 'HAN', 'SAE', 'COG', 'COGNEW',
})


def normalize_bible_book_code(value):
    normalized = value.strip().lower()
    return 'jnh' if normalized == 'jon' else normalized


class BibleLocationValidationMixin:
    def validate_book(self, value):
        if not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError('성경책 코드가 올바르지 않습니다.')

        normalized = normalize_bible_book_code(value)
        if normalized not in BIBLE_BOOK_CHAPTERS:
            raise serializers.ValidationError('지원하지 않는 성경책 코드입니다.')

        return normalized

    def validate_chapter(self, value):
        if value < 1:
            raise serializers.ValidationError('장 번호는 1 이상이어야 합니다.')
        return value

    def validate(self, attrs):
        book = attrs.get('book') or getattr(self.instance, 'book', None)
        chapter = attrs.get('chapter') or getattr(self.instance, 'chapter', None)

        if book is None or chapter is None:
            return attrs

        normalized_book = normalize_bible_book_code(book)
        max_chapter = BIBLE_BOOK_CHAPTERS.get(normalized_book)
        if max_chapter is not None and chapter > max_chapter:
            raise serializers.ValidationError({
                'chapter': f'{BIBLE_BOOKS_KOR.get(normalized_book, normalized_book)}은 {max_chapter}장까지 있습니다.'
            })

        return attrs


class VerseWindowValidationMixin:
    def _verse_window_value(self, attrs, field):
        if field in attrs:
            return attrs[field]
        return getattr(self.instance, field, None)

    def _validate_positive_verse(self, attrs, field):
        value = self._verse_window_value(attrs, field)
        if value is not None and value < 1:
            raise serializers.ValidationError({field: '절 번호는 1 이상이어야 합니다.'})

    def _validate_verse_window(self, attrs, *, require_window=False):
        start_verse = self._verse_window_value(attrs, 'start_verse')
        end_verse = self._verse_window_value(attrs, 'end_verse')

        if require_window and (start_verse is None or end_verse is None):
            raise serializers.ValidationError({
                'start_verse': '시작 절과 끝 절이 모두 필요합니다.',
                'end_verse': '시작 절과 끝 절이 모두 필요합니다.',
            })

        if start_verse is None and end_verse is None:
            return

        if start_verse is None or end_verse is None:
            raise serializers.ValidationError({
                'start_verse': '시작 절과 끝 절을 함께 입력해야 합니다.',
                'end_verse': '시작 절과 끝 절을 함께 입력해야 합니다.',
            })

        self._validate_positive_verse(attrs, 'start_verse')
        self._validate_positive_verse(attrs, 'end_verse')
        if end_verse < start_verse:
            raise serializers.ValidationError({'end_verse': '끝 절은 시작 절보다 작을 수 없습니다.'})


class UserReadingPositionSerializer(BibleLocationValidationMixin, serializers.ModelSerializer):
    """마지막 읽기 위치 Serializer"""
    class Meta:
        model = UserReadingPosition
        fields = ['book', 'chapter', 'verse', 'scroll_position', 'version', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_scroll_position(self, value):
        if value < 0 or value > 1:
            raise serializers.ValidationError('스크롤 위치는 0과 1 사이여야 합니다.')
        return value

    def validate_version(self, value):
        if not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError('역본 코드가 올바르지 않습니다.')

        normalized = value.strip().upper()
        if normalized not in SUPPORTED_READING_VERSIONS:
            raise serializers.ValidationError('지원하지 않는 역본 코드입니다.')

        return normalized

    def validate_verse(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError('절 번호는 1 이상이어야 합니다.')
        return value


class BibleBookmarkSerializer(VerseWindowValidationMixin, BibleLocationValidationMixin, serializers.ModelSerializer):
    """북마크 Serializer"""
    book_name = serializers.SerializerMethodField()

    class Meta:
        model = BibleBookmark
        fields = [
            'id', 'bookmark_type', 'book', 'book_name', 'chapter',
            'start_verse', 'end_verse', 'title', 'color', 'memo',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_book_name(self, obj) -> str:
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bookmark_type = attrs.get('bookmark_type') or getattr(self.instance, 'bookmark_type', None)
        self._validate_verse_window(attrs, require_window=bookmark_type == 'verse')
        return attrs


class ReflectionNoteSerializer(VerseWindowValidationMixin, BibleLocationValidationMixin, serializers.ModelSerializer):
    """묵상노트 Serializer"""
    book_name = serializers.SerializerMethodField()

    class Meta:
        model = ReflectionNote
        fields = [
            'id', 'book', 'book_name', 'chapter',
            'start_verse', 'end_verse', 'content', 'is_private',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_book_name(self, obj) -> str:
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        self._validate_verse_window(attrs)
        return attrs


class BibleHighlightSerializer(VerseWindowValidationMixin, BibleLocationValidationMixin, serializers.ModelSerializer):
    """하이라이트 Serializer"""
    book_name = serializers.SerializerMethodField()

    class Meta:
        model = BibleHighlight
        fields = [
            'id', 'book', 'book_name', 'chapter',
            'start_verse', 'end_verse', 'color', 'memo',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'book_name', 'created_at', 'updated_at']

    def get_book_name(self, obj) -> str:
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        self._validate_verse_window(attrs, require_window=True)
        return attrs


class PersonalReadingRecordSerializer(BibleLocationValidationMixin, serializers.ModelSerializer):
    """개인 읽기 기록 Serializer"""
    book_name = serializers.SerializerMethodField()
    read_date = serializers.DateField(default=date.today)

    class Meta:
        model = PersonalReadingRecord
        fields = ['id', 'book', 'book_name', 'chapter', 'read_date', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_book_name(self, obj) -> str:
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)


class SuccessMessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()


class BibleBookmarkByChapterResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    bookmarks = BibleBookmarkSerializer(many=True)


class ReflectionNoteByChapterResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    notes = ReflectionNoteSerializer(many=True)


class BibleHighlightByChapterResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    highlights = BibleHighlightSerializer(many=True)


class PersonalRecordsByBookResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    records = PersonalReadingRecordSerializer(many=True)
    read_chapters = serializers.ListField(child=serializers.IntegerField())
    total_chapters = serializers.IntegerField()
    is_completed = serializers.BooleanField()


class PersonalRecordDatesResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    dates = serializers.ListField(child=serializers.DateField())


class BookProgressSerializer(serializers.Serializer):
    read = serializers.IntegerField()
    total = serializers.IntegerField()


class PersonalRecordStatsDataSerializer(serializers.Serializer):
    total_chapters_read = serializers.IntegerField()
    books_read = serializers.IntegerField()
    books_completed = serializers.IntegerField()
    current_streak = serializers.IntegerField()
    books_progress = serializers.DictField(child=BookProgressSerializer())


class PersonalRecordStatsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    stats = PersonalRecordStatsDataSerializer()


HASENA_RECORD_MIN_DATE = date(1900, 1, 1)
HASENA_RECORD_MAX_DATE = date(2100, 1, 1)


class HasenaRecordCreateSerializer(serializers.Serializer):
    """하세나 기록 생성/업데이트 Serializer.

    Bounds `date` to the [1900-01-01, 2100-01-01] window and rejects any
    non-boolean `is_completed` (DRF's default `BooleanField` accepts strings
    like "yes"/"no" — this endpoint requires a real bool).
    """

    date = serializers.DateField()
    is_completed = serializers.BooleanField(default=True)

    def validate_date(self, value):
        if value < HASENA_RECORD_MIN_DATE or value > HASENA_RECORD_MAX_DATE:
            raise serializers.ValidationError(
                f'날짜는 {HASENA_RECORD_MIN_DATE.isoformat()}부터 '
                f'{HASENA_RECORD_MAX_DATE.isoformat()} 사이여야 합니다.'
            )
        return value

    def to_internal_value(self, data):
        raw = data.get('is_completed', serializers.empty)
        if raw is not serializers.empty and not isinstance(raw, bool):
            raise serializers.ValidationError({
                'is_completed': ['is_completed는 true 또는 false 값이어야 합니다.']
            })
        return super().to_internal_value(data)
