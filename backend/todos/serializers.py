from datetime import date
from decimal import Decimal

from rest_framework import serializers
from .models import (
    DailyBibleSchedule, UserBibleProgress, BibleReadingPlan,
    PlanSubscription, VideoBibleIntro, UserPlanDisplaySettings,
    CatchupSession, CatchupSchedule,
    UserReadingPosition, BibleBookmark, ReflectionNote, BibleHighlight, PersonalReadingRecord,
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

class UserBibleProgressSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='subscription.plan.name', read_only=True)
    date = serializers.SerializerMethodField()
    
    class Meta:
        model = UserBibleProgress
        fields = ['id', 'subscription', 'plan_name', 'is_completed', 'completed_at', 'date', 'schedule']
        
    def get_date(self, obj):
        # N+1 방지를 위해 schedule을 select_related로 가져오세요.
        return obj.schedule.date if obj.schedule else None


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
    
    def get_created_by_username(self, obj):
        # N+1 방지를 위해 created_by를 select_related로 가져오세요.
        if obj.created_by:
            return obj.created_by.username
        return None
    
    def get_subscriber_count(self, obj):
        if hasattr(obj, 'subscriber_count'):
            return obj.subscriber_count
        return obj.plansubscription_set.filter(is_active=True).count()

class PlanSubscriptionSerializer(serializers.ModelSerializer):
    plan_id = serializers.IntegerField(source='plan.id')
    plan_name = serializers.CharField(source='plan.name')
    is_default = serializers.BooleanField(source='plan.is_default')
    
    class Meta:
        model = PlanSubscription
        fields = [
            'id', 'plan_id', 'plan_name', 
            'is_active', 'is_default', 'start_date'
        ]

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


class CatchupSessionCreateSerializer(serializers.ModelSerializer):
    """따라잡기 세션 생성 Serializer"""
    class Meta:
        model = CatchupSession
        fields = [
            'name', 'range_start', 'range_end',
            'strategy', 'target_rejoin_date',
            'max_daily_readings', 'max_daily_chapters', 'weekend_multiplier'
        ]

    def validate(self, data):
        if data.get('range_end') and data.get('range_start'):
            if data['range_end'] < data['range_start']:
                raise serializers.ValidationError({
                    'range_end': '종료일은 시작일 이후여야 합니다.'
                })
        return data


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


class UserReadingPositionSerializer(serializers.ModelSerializer):
    """마지막 읽기 위치 Serializer"""
    class Meta:
        model = UserReadingPosition
        fields = ['book', 'chapter', 'verse', 'scroll_position', 'version', 'updated_at']
        read_only_fields = ['updated_at']

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


class BibleBookmarkSerializer(serializers.ModelSerializer):
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

    def get_book_name(self, obj):
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)


class ReflectionNoteSerializer(serializers.ModelSerializer):
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

    def get_book_name(self, obj):
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)


class BibleHighlightSerializer(serializers.ModelSerializer):
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

    def get_book_name(self, obj):
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)


class PersonalReadingRecordSerializer(serializers.ModelSerializer):
    """개인 읽기 기록 Serializer"""
    book_name = serializers.SerializerMethodField()
    read_date = serializers.DateField(default=date.today)

    class Meta:
        model = PersonalReadingRecord
        fields = ['id', 'book', 'book_name', 'chapter', 'read_date', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_book_name(self, obj):
        return BIBLE_BOOKS_KOR.get(obj.book, obj.book)
