from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
import pandas as pd
from datetime import datetime
from django.conf import settings
from .models import DailyBibleSchedule, UserBibleProgress, BibleReadingPlan, PlanSubscription, VideoBibleIntro, HasenaRecord, UserVideoIntroProgress, VisitorCount
from .serializers import DailyBibleScheduleSerializer, UserBibleProgressSerializer, BibleProgressResponse, BibleReadingPlanSerializer, PlanSubscriptionSerializer, VideoBibleIntroSerializer
import logging
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q
from django.utils.dateparse import parse_date
import re
from io import BytesIO
from django.utils.timezone import localtime

logger = logging.getLogger(__name__)
User = get_user_model()

# 최상단에 book_to_code 딕셔너리 정의
book_to_code = {
    '창세기': 'gen', '출애굽기': 'exo', '레위기': 'lev',
    '민수기': 'num', '신명기': 'deu', '여호수아': 'jos',
    '사사기': 'jdg', '룻기': 'rut', '사무엘상': '1sa',
    '사무엘하': '2sa', '열왕기상': '1ki', '열왕기하': '2ki',
    '역대상': '1ch', '역대하': '2ch', '에스라': 'ezr',
    '느헤미야': 'neh', '에스더': 'est', '욥기': 'job',
    '시편': 'psa', '잠언': 'pro', '전도서': 'ecc',
    '아가': 'sng', '이사야': 'isa', '예레미야': 'jer',
    '예레미야애가': 'lam', '에스겔': 'ezk', '다니엘': 'dan',
    '호세아': 'hos', '요엘': 'jol', '아모스': 'amo',
    '오바댜': 'oba', '요나': 'jnh', '미가': 'mic',
    '나훔': 'nam', '하박국': 'hab', '스바냐': 'zep',
    '학개': 'hag', '스가랴': 'zec', '말라기': 'mal',
    '마태복음': 'mat', '마가복음': 'mrk', '누가복음': 'luk',
    '요한복음': 'jhn', '사도행전': 'act', '로마서': 'rom',
    '고린도전서': '1co', '고린도후서': '2co', '갈라디아서': 'gal',
    '에베소서': 'eph', '빌립보서': 'php', '골로새서': 'col',
    '데살로니가전서': '1th', '데살로니가후서': '2th',
    '디모데전서': '1ti', '디모데후서': '2ti', '디도서': 'tit',
    '빌레몬서': 'phm', '히브리서': 'heb', '야고보서': 'jas',
    '베드로전서': '1pe', '베드로후서': '2pe', '요한일서': '1jn',
    '요한이서': '2jn', '요한삼서': '3jn', '유다서': 'jud',
    '요한계시록': 'rev'
}

# 성경별 총 장 수를 반환하는 함수 필요
def get_last_chapter(book_name):
    book_chapters = {
        '창세기': 50, '출애굽기': 40, '레위기': 27,
        '민수기': 36, '신명기': 34, '여호수아': 24,
        '사사기': 21, '룻기': 4, '사무엘상': 31,
        '사무엘하': 24, '열왕기상': 22, '열왕기하': 25,
        '역대상': 29, '역대하': 36, '에스라': 10,
        '느헤미야': 13, '에스더': 10, '욥기': 42,
        '시편': 150, '잠언': 31, '전도서': 12,
        '아가': 8, '이사야': 66, '예레미야': 52,
        '예레미야애가': 5, '에스겔': 48, '다니엘': 12,
        '호세아': 14, '요엘': 3, '아모스': 9,
        '오바댜': 1, '요나': 4, '미가': 7,
        '나훔': 3, '하박국': 3, '스바냐': 3,
        '학개': 2, '스가랴': 14, '말라기': 4,
        '마태복음': 28, '마가복음': 16, '누가복음': 24,
        '요한복음': 21, '사도행전': 28, '로마서': 16,
        '고린도전서': 16, '고린도후서': 13, '갈라디아서': 6,
        '에베소서': 6, '빌립보서': 4, '골로새서': 4,
        '데살로니가전서': 5, '데살로니가후서': 3,
        '디모데전서': 6, '디모데후서': 4, '디도서': 3,
        '빌레몬서': 1, '히브리서': 13, '야고보서': 5,
        '베드로전서': 5, '베드로후서': 3, '요한일서': 5,
        '요한이서': 1, '요한삼서': 1, '유다서': 1,
        '요한계시록': 22
    }
    result = book_chapters.get(book_name, 1)  # 기본값 1
    return result

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_bible_progress(request):
    """
    성경 진도 업데이트 API
    
    [필수 파라미터]
    - plan_id: 플랜 ID (문자열)
    - schedule_ids: 스케줄 ID 리스트 (배열)
    - action: 'complete' 또는 'cancel' (문자열)
    
    [요청 예시]
    {
        "plan_id": "1",
        "schedule_ids": ["42", "43", "44"],
        "action": "complete"
    }
    
    [응답 예시 - 성공]
    {
        "success": true,
        "plan_id": "1",
        "schedule_ids": ["42", "43", "44"],
        "is_completed": true
    }
    
    [응답 예시 - 실패]
    {
        "success": false,
        "error": "스케줄 ID와 플랜 ID가 일치하지 않습니다."
    }
    """
    try:
        plan_id = request.data.get('plan_id')
        schedule_ids = request.data.get('schedule_ids', [])
        action = request.data.get('action')

        # 필수 파라미터 검증
        if not all([plan_id, schedule_ids, action]):
            return Response({
                'success': False,
                'error': '필수 파라미터(plan_id, schedule_ids, action)가 누락되었습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if action not in ['complete', 'cancel']:
            return Response({
                'success': False,
                'error': 'action은 complete 또는 cancel이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 1. 스케줄 조회 및 검증
        try:
            daily_schedules = DailyBibleSchedule.objects.filter(id__in=schedule_ids)
            if not daily_schedules.exists():
                return Response({
                    'success': False,
                    'error': '존재하지 않는 스케줄입니다.'
                }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error in update_bible_progress schedule lookup: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'error': '요청 처리 중 오류가 발생했습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 2. 스케줄의 plan_id와 요청의 plan_id 일치 여부 검증
        if daily_schedules.filter(plan_id=plan_id).count() != len(schedule_ids):
            return Response({
                'success': False,
                'error': '스케줄 ID와 플랜 ID가 일치하지 않습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. 사용자의 플랜 구독 확인
        try:
            subscription = PlanSubscription.objects.get(
                user=request.user,
                plan_id=plan_id,
                is_active=True
            )
        except PlanSubscription.DoesNotExist:
            return Response({
                'success': False,
                'error': '구독 중인 플랜이 아닙니다.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 4. 진도 업데이트 또는 생성 (bulk 연산으로 최적화)
        is_completed = action == 'complete'
        now = timezone.now()
        with transaction.atomic():
            existing_qs = UserBibleProgress.objects.filter(
                subscription=subscription,
                schedule__in=daily_schedules
            )
            existing_schedule_ids = set(existing_qs.values_list('schedule_id', flat=True))

            # 기존 레코드 bulk update (1 쿼리)
            # 완료 시각은 최초 완료 시점을 보존하고, 취소 시에는 초기화한다.
            if is_completed:
                existing_qs.filter(
                    Q(is_completed=False) | Q(completed_at__isnull=True)
                ).update(is_completed=True, completed_at=now)
            else:
                existing_qs.update(is_completed=False, completed_at=None)

            # 새 레코드 bulk create (1 쿼리)
            # ignore_conflicts: 동시 요청이 같은 진도를 만들어도 중복 생성되지 않음
            new_progress = [
                UserBibleProgress(
                    subscription=subscription,
                    schedule=schedule,
                    is_completed=is_completed,
                    completed_at=now if is_completed else None
                )
                for schedule in daily_schedules
                if schedule.id not in existing_schedule_ids
            ]
            if new_progress:
                UserBibleProgress.objects.bulk_create(new_progress, ignore_conflicts=True)

        return Response({
            'success': True,
            'plan_id': str(plan_id),
            'schedule_ids': [str(id) for id in schedule_ids],
            'is_completed': is_completed
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error in update_bible_progress: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_reading_history(request):
    plan_id = request.query_params.get('plan_id')
    month = request.query_params.get('month')
    
    logger.info(f'Fetching reading history for user: {request.user.id}, plan: {plan_id}, month: {month}')
    
    if not plan_id:
        logger.warning("Plan ID is missing from request")
        return Response({'error': 'Plan ID is required'}, status=400)
        
    try:
        plan_id = int(plan_id)
        
        if month:
            month = int(month)
            logger.info(f"Filtering progress for plan_id={plan_id}, month={month}")
            # schedule을 통해 해당 월의 progress 조회
            schedules = DailyBibleSchedule.objects.filter(
                plan_id=plan_id,
                date__month=month
            )
            progress = UserBibleProgress.objects.filter(
                subscription__plan_id=plan_id,
                subscription__user=request.user,
                schedule__in=schedules
            ).select_related('schedule').order_by('schedule__date')
        else:
            logger.info(f"Filtering progress for plan_id={plan_id}")
            progress = UserBibleProgress.objects.filter(
                subscription__plan_id=plan_id,
                subscription__user=request.user
            ).select_related('schedule').order_by('schedule__date')
            
        serializer = UserBibleProgressSerializer(progress, many=True)
        logger.info(f"Found {len(progress)} progress records")
        return Response(serializer.data)
    except ValueError as ve:
        logger.error(f"Invalid parameter format: {str(ve)}")
        return Response({'error': 'Invalid plan ID or month format'}, status=400)
    except Exception as e:
        logger.error(f"Error in get_reading_history: {str(e)}", exc_info=True)
        return Response({'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_schedules_for_month(request):
    month = request.query_params.get('month')
    plan_id = request.query_params.get('plan_id')
    user = request.user
    
    if not month or not plan_id:
        return Response({
            'error': 'Month and plan ID are required'
        }, status=400)
    
    try:
        month = int(month)
        plan_id = int(plan_id)
        
        plan = BibleReadingPlan.objects.get(id=plan_id)
        schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date__month=month
        ).order_by('date')
        
        # 비로그인 사용자인 경우 기본 일정 정보만 반환
        if not user.is_authenticated:
            schedule_data = [DailyBibleScheduleSerializer(schedule).data for schedule in schedules]
            return Response(schedule_data)
        
        # 로그인 사용자인 경우 읽기 상태 정보 포함
        subscription = PlanSubscription.objects.filter(
            user=user,
            plan=plan,
            is_active=True
        ).first()
        
        if subscription:
            # schedule을 기준으로 progress 조회
            progress_records = UserBibleProgress.objects.filter(
                subscription=subscription,
                schedule__in=schedules
            ).select_related('schedule')
            
            # schedule_id를 키로 하는 progress 딕셔너리 생성
            progress_dict = {
                record.schedule_id: record.is_completed 
                for record in progress_records
            }
            
            schedule_data = []
            for schedule in schedules:
                schedule_dict = DailyBibleScheduleSerializer(schedule).data
                schedule_dict['is_completed'] = progress_dict.get(schedule.id, False)
                schedule_data.append(schedule_dict)
            
            return Response(schedule_data)
        
        # 구독이 없는 경우 기본 일정 정보만 반환
        return Response([DailyBibleScheduleSerializer(schedule).data for schedule in schedules])
        
    except Exception as e:
        logger.error(f"Error in get_schedules_for_month: {str(e)}", exc_info=True)
        return Response({
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=500)

class IsStaffOrReadOnly(permissions.BasePermission):
    """
    관리자만 생성/수정/삭제 가능, 일반 사용자는 조회만 가능
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff

class DailyBibleScheduleViewSet(viewsets.ModelViewSet):
    queryset = DailyBibleSchedule.objects.all()
    serializer_class = DailyBibleScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        # 플랜 ID로 필터링
        plan_id = self.request.query_params.get('plan_id')
        if plan_id:
            # 디버깅 로그 추가
            logger.info(f"Fetching schedules for plan_id: {plan_id}")
            queryset = DailyBibleSchedule.objects.filter(plan_id=plan_id)
            logger.info(f"Found {queryset.count()} schedules")
            return queryset
        return super().get_queryset()
    
    @action(detail=False, methods=['post'])
    def upload_excel(self, request):
        """엑셀 파일로 세부 일정 대량 업로드"""
        plan_id = request.data.get('plan_id')
        file = request.FILES.get('file')
        update_mode = request.data.get('update_mode', 'add')  # 'add', 'update', 'replace'
        
        if not plan_id or not file:
            return Response(
                {"detail": "플랜 ID와 파일은 필수 항목입니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 플랜 존재 여부 확인
            plan = BibleReadingPlan.objects.get(id=plan_id)
            
            # 엑셀 파일 읽기
            df = pd.read_excel(file)
            
            # 필수 열 확인
            required_columns = ['날짜', '성경', '시작장', '끝장']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {"detail": f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 기존 일정 관리
            if update_mode == 'replace':
                # 기존 일정 모두 삭제
                DailyBibleSchedule.objects.filter(plan=plan).delete()
            
            # 데이터 변환 및 저장
            success_count = 0
            error_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # 날짜 변환
                    date_str = row['날짜']
                    if isinstance(date_str, str):
                        # YYYY-MM-DD 형식이 아닌 경우 변환
                        if re.match(r'\d{4}\.\d{1,2}\.\d{1,2}', date_str):
                            date_str = date_str.replace('.', '-')
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    else:
                        # pandas가 자동으로 datetime으로 변환한 경우
                        date_obj = date_str.date() if hasattr(date_str, 'date') else date_str
                    
                    # 필드 값 추출
                    book = row['성경']
                    start_chapter = int(row['시작장'])
                    end_chapter = int(row['끝장'])
                    
                    # URL 필드 처리 개선
                    audio_link = row.get('오디오', '')
                    guide_link = row.get('가이드', '')

                    # 데이터 타입 확인 및 변환 
                    # float 타입이 들어온 경우 처리
                    if isinstance(audio_link, float) or isinstance(guide_link, float):
                        logger.info(f"행 {index+2}: float 타입 URL 필드 발견, 변환 시도")

                    # 유효한 URL로 변환
                    audio_link = self._validate_url(audio_link)
                    guide_link = self._validate_url(guide_link)
                    
                    # 업데이트 모드 처리
                    if update_mode in ['add', 'replace']:
                        # 신규 추가
                        DailyBibleSchedule.objects.create(
                            plan=plan,
                            date=date_obj,
                            book=book,
                            start_chapter=start_chapter,
                            end_chapter=end_chapter,
                            audio_link=audio_link,
                            guide_link=guide_link
                        )
                    else:  # update 모드
                        # 기존 레코드 업데이트 또는 생성
                        obj, created = DailyBibleSchedule.objects.update_or_create(
                            plan=plan,
                            date=date_obj,
                            defaults={
                                'book': book,
                                'start_chapter': start_chapter,
                                'end_chapter': end_chapter,
                                'audio_link': audio_link,
                                'guide_link': guide_link
                            }
                        )
                    
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error in upload_excel row {index + 2}: {str(e)}", exc_info=True)
                    errors.append(f"행 {index + 2}: 처리 중 오류가 발생했습니다.")
            
            return Response({
                "detail": f"{success_count}개의 일정이 처리되었습니다. 오류: {error_count}개",
                "errors": errors if errors else None
            })
            
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {"detail": "해당 ID의 플랜을 찾을 수 없습니다."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in upload_excel: {str(e)}", exc_info=True)
            return Response(
                {"detail": "요청 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def _validate_url(self, url):
        """URL을 검증하고 필요하면 수정합니다"""
        # None 값 처리
        if url is None:
            return ''
        
        # float 타입이면 문자열로 변환
        if isinstance(url, float):
            # NaN 체크
            if pd.isna(url):
                return ''
            # 소수점 없는 정수형 숫자로 보이면 정수로 변환 (예: 12.0 -> '12')
            if url.is_integer():
                url = str(int(url))
            else:
                url = str(url)
        
        # 문자열 타입이 아니면 문자열로 변환
        if not isinstance(url, str):
            url = str(url)
        
        # 공백 제거
        url = url.strip()
        
        # 빈 문자열 처리
        if url == '':
            return ''
        
        # URL에 스키마가 없으면 https:// 추가
        if not url.startswith(('http://', 'https://')):
            return 'https://' + url
        
        return url

    # 추가 디버깅 액션
    @action(detail=False, methods=['get'])
    def debug_plan_schedules(self, request):
        """특정 플랜의 스케줄 데이터 디버깅"""
        plan_id = request.query_params.get('plan_id')
        if not plan_id:
            return Response({"error": "plan_id is required"}, status=400)
            
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
            schedules = DailyBibleSchedule.objects.filter(plan=plan)
            
            return Response({
                "plan_name": plan.name,
                "plan_id": plan.id,
                "schedule_count": schedules.count(),
                "schedules": DailyBibleScheduleSerializer(schedules, many=True).data[:5]  # 최대 5개 표시
            })
        except BibleReadingPlan.DoesNotExist:
            return Response({"error": f"Plan with id {plan_id} not found"}, status=404)
        except Exception as e:
            logger.error(f"Error in debug_plan_schedules: {str(e)}", exc_info=True)
            return Response({"error": "요청 처리 중 오류가 발생했습니다."}, status=500)

    @action(detail=True, methods=['post'])
    def generate_test_schedules(self, request, pk=None):
        """테스트용 일정 생성"""
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다"}, status=403)
        
        plan = self.get_object()
        count = int(request.data.get('count', 5))  # 기본 5개
        
        # 테스트 데이터 생성
        import random
        from datetime import timedelta, date
        
        bible_books = ["창세기", "출애굽기", "레위기", "민수기", "신명기"]
        start_date = date.today()
        
        created_schedules = []
        for i in range(count):
            schedule_date = start_date + timedelta(days=i)
            book = random.choice(bible_books)
            start_chapter = random.randint(1, 10)
            end_chapter = start_chapter + random.randint(0, 5)
            
            schedule = DailyBibleSchedule.objects.create(
                plan=plan,
                date=schedule_date,
                book=book,
                start_chapter=start_chapter,
                end_chapter=end_chapter,
                audio_link=f"https://example.com/audio/{book}/{start_chapter}-{end_chapter}",
                guide_link=f"https://example.com/guide/{book}/{start_chapter}-{end_chapter}"
            )
            created_schedules.append(DailyBibleScheduleSerializer(schedule).data)
        
        return Response({
            "detail": f"{count}개의 테스트 일정이 생성되었습니다",
            "schedules": created_schedules
        })

class BibleReadingPlanViewSet(viewsets.ModelViewSet):
    """성경 읽기 플랜 관리를 위한 ViewSet"""
    queryset = BibleReadingPlan.objects.all()
    serializer_class = BibleReadingPlanSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        """사용자 권한에 따라 쿼리셋 필터링"""
        if self.request.user.is_staff:
            # 관리자는 모든 플랜 조회 가능
            return BibleReadingPlan.objects.all()
        else:
            # 일반 사용자는 활성화된 플랜만 조회 가능
            return BibleReadingPlan.objects.filter(is_active=True)

    def perform_create(self, serializer):
        """플랜 생성 시 생성자 정보 추가"""
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        """기존 생성자 정보를 유지하면서 업데이트"""
        instance = self.get_object()
        serializer.save(created_by=instance.created_by)

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """플랜 활성화/비활성화 토글"""
        plan = self.get_object()
        # 활성화 상태만 토글
        plan.is_active = not plan.is_active
        
        # update_fields 파라미터를 사용하여 특정 필드만 업데이트
        plan.save(update_fields=['is_active'])
        
        return Response({'detail': f'플랜이 {"활성화" if plan.is_active else "비활성화"}되었습니다.'})

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """특정 플랜을 기본 플랜으로 설정"""
        # 기존의 기본 플랜을 모두 해제
        BibleReadingPlan.objects.filter(is_default=True).update(is_default=False)
        
        # 현재 플랜을 기본으로 설정
        plan = self.get_object()
        plan.is_default = True
        
        # update_fields 파라미터를 사용하여 특정 필드만 업데이트
        plan.save(update_fields=['is_default'])
        
        return Response({'detail': '기본 플랜으로 설정되었습니다.'})

    @action(detail=True, methods=['get'])
    def schedules(self, request, pk=None):
        """특정 플랜의 스케줄 목록 조회"""
        plan = self.get_object()
        schedules = plan.schedules.all()
        serializer = DailyBibleScheduleSerializer(schedules, many=True)
        return Response(serializer.data)

@api_view(['GET', 'POST'])
@permission_classes([permissions.AllowAny])
def plan_subscription_list(request):
    """플랜 구독 목록 조회 및 생성"""
    # 비로그인 사용자인 경우 활성화된 모든 공개 플랜 반환
    if not request.user.is_authenticated:
        public_plans = BibleReadingPlan.objects.filter(is_active=True).order_by('-is_default', 'name')
        if not public_plans.exists():
            return Response({
                'error': '활성화된 플랜이 없습니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 기본 플랜이 먼저 오도록 정렬된 목록 반환
        return Response([{
            'plan_id': plan.id,
            'plan_name': plan.name,
            'is_default': plan.is_default
        } for plan in public_plans])

    # GET 요청 처리 (구독 목록 조회)
    if request.method == 'GET':
        # 로그인 사용자인 경우 중복 없는 구독 목록 반환
        queryset = PlanSubscription.objects.filter(
            user=request.user,
            is_active=True
        ).distinct()  # 중복 제거
        serializer = PlanSubscriptionSerializer(queryset, many=True)
        return Response(serializer.data)
    
    # POST 요청 처리 (구독 생성)
    elif request.method == 'POST':
        # 이미 구독 중인 플랜인지 확인
        plan_id = request.data.get('plan')
        if PlanSubscription.objects.filter(user=request.user, plan_id=plan_id).exists():
            return Response(
                {"detail": "이미 구독 중인 플랜입니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 플랜 정보 가져오기
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {"detail": "존재하지 않는 플랜입니다."},
                status=status.HTTP_404_NOT_FOUND
            )

        # 비활성화된 플랜은 신규 구독 불가
        if not plan.is_active:
            return Response(
                {"detail": "현재 신규 구독이 중단된 플랜입니다."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 구독 생성
        subscription = PlanSubscription.objects.create(
            user=request.user, 
            plan=plan,
            start_date=timezone.now().date()
        )
        
        serializer = PlanSubscriptionSerializer(subscription)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def plan_subscription_detail(request, pk):
    """플랜 구독 상세 조회, 수정, 삭제"""
    try:
        subscription = PlanSubscription.objects.get(pk=pk, user=request.user)
    except PlanSubscription.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    # GET 요청 처리 (상세 조회)
    if request.method == 'GET':
        serializer = PlanSubscriptionSerializer(subscription)
        return Response(serializer.data)
    
    # PUT 요청 처리 (수정)
    elif request.method == 'PUT':
        serializer = PlanSubscriptionSerializer(subscription, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    # DELETE 요청 처리 (삭제)
    elif request.method == 'DELETE':
        # 기본 플랜 구독은 삭제할 수 없음
        if subscription.plan.is_default:
            return Response(
                {"detail": "기본 플랜 구독은 삭제할 수 없습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        subscription.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def plan_subscription_toggle_active(request, pk):
    """구독 활성화/비활성화 토글"""
    try:
        subscription = PlanSubscription.objects.get(pk=pk, user=request.user)
    except PlanSubscription.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    # 기본 플랜 구독은 비활성화할 수 없음
    if subscription.plan.is_default and subscription.is_active:
        return Response(
            {"detail": "기본 플랜 구독은 취소할 수 없습니다."}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    subscription.is_active = not subscription.is_active
    subscription.save()
    
    return Response({"is_active": subscription.is_active})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def plan_subscription_progress(request, pk):
    """특정 구독의 진도 목록 조회"""
    try:
        subscription = PlanSubscription.objects.get(pk=pk, user=request.user)
    except PlanSubscription.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    progress = subscription.progress.all()
    serializer = UserBibleProgressSerializer(progress, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_chapter_detail(request):
    """
    1. 특정 장의 상세 데이터 조회
    """
    try:
        # 요청 파라미터
        plan_id = request.GET.get('plan_id')
        book = request.GET.get('book')
        chapter = request.GET.get('chapter')
        user = request.user if request.user.is_authenticated else None

        # book과 chapter는 필수 파라미터
        if not all([book, chapter]):
            return Response({'error': '필수 파라미터(book, chapter)가 누락되었습니다.'}, status=400)

        # 책 코드 -> 한글 이름 변환
        code_to_book = {v: k for k, v in book_to_code.items()}
        book_name = code_to_book.get(book)
        if not book_name:
            return Response({'error': '잘못된 성경 코드입니다.'}, status=400)

        # 기본 응답 데이터 (plan_id가 없을 때 반환할 기본 정보)
        response_data = {
            'book': book,
            'book_kor': book_name,
            'book_unit_kor': '편' if book == 'psa' else '장',
            'chapter': chapter,
            'is_logined': user is not None
        }

        # plan_id가 없으면 기본 정보만 반환
        if not plan_id:
            return Response(response_data)

        # plan_id가 있는 경우 추가 정보 조회
        plan = get_object_or_404(BibleReadingPlan, id=plan_id)

        # 해당 장이 속한 일정 조회
        target_schedule = DailyBibleSchedule.objects.filter(
            plan=plan,
            book=book_name,
            start_chapter__lte=int(chapter),
            end_chapter__gte=int(chapter)
        ).first()

        if not target_schedule:
            # 에러 코드 대신 정상 응답으로 메시지 전달
            response_data.update({
                'plan_id': plan_id,
                'plan_name': plan.name,
                'message': f"이 플랜에는 현재 위치에 대한 일정이 없어요.",
                'plan_detail': []
            })
            return Response(response_data)

        # 같은 날짜의 모든 일정 조회
        schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date=target_schedule.date
        ).order_by('id')

        progress_dict = {}

        # 읽기 상태 확인 (로그인 상태일 경우)
        if user:
            subscription = PlanSubscription.objects.filter(
                user=user,
                plan=plan,
                is_active=True
            ).first()

            if subscription:
                progress_records = UserBibleProgress.objects.filter(
                    subscription=subscription,
                    schedule__in=schedules,
                    is_completed=True
                ).values_list('schedule_id', flat=True)
                
                progress_dict = {str(schedule_id): True for schedule_id in progress_records}

        # 추가 응답 데이터
        response_data.update({
            'audio_link': target_schedule.audio_link,
            'guide_link': target_schedule.guide_link,
            'plan_id': plan_id,
            'plan_name': plan.name,
            'plan_date': target_schedule.date.isoformat(),
            'is_complete': False,
            'plan_detail': []
        })

        # 플랜 상세 정보 구성
        for schedule in schedules:
            schedule_id = str(schedule.id)
            response_data['plan_detail'].append({
                'book': book_to_code.get(schedule.book, 'gen'),
                'book_kor': schedule.book,
                'book_unit_kor': '편' if schedule.book == '시편' else '장',
                'start_chapter': schedule.start_chapter,
                'end_chapter': schedule.end_chapter,
                'schedule_id': schedule_id,
                'date': schedule.date.isoformat(),
                'is_complete': progress_dict.get(schedule_id, False)
            })

        # 전체 완료 상태 업데이트
        response_data['is_complete'] = all(
            progress_dict.get(item['schedule_id'], False) 
            for item in response_data['plan_detail']
        )

        return Response(response_data)

    except Exception as e:
        logger.error(f"Error in get_chapter_detail: {str(e)}", exc_info=True)
        return Response({'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_today_schedules(request):
    """
    오늘 날짜의 성경 일정을 반환하는 API
    
    [필수 파라미터]
    - plan_id: 플랜 ID
    
    [응답 예시]
    {
        "success": true,
        "schedules": [
            {
                "id": 123,
                "book": "창세기",
                "start_chapter": 1,
                "end_chapter": 3,
                "audio_link": "https://example.com/audio",
                "guide_link": "https://example.com/guide",
                "is_completed": false
            },
            ...
        ]
    }
    """
    try:
        plan_id = request.query_params.get('plan_id')
        
        if not plan_id:
            return Response({
                'success': False,
                'error': '플랜 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        # 플랜 존재 여부 확인
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return Response({
                'success': False,
                'error': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 오늘 날짜 가져오기
        today = timezone.now().date()
        
        # 오늘 날짜의 일정 조회
        schedules = DailyBibleSchedule.objects.filter(
            plan_id=plan_id,
            date=today
        ).order_by('id')
        
        if not schedules.exists():
            return Response({
                'success': True,
                'schedules': []
            })
        
        # 사용자 인증 여부 확인
        user = request.user
        progress_dict = {}
        
        if user.is_authenticated:
            # 사용자의 구독 확인
            subscription = PlanSubscription.objects.filter(
                user=user,
                plan_id=plan_id,
                is_active=True
            ).first()
            
            if subscription:
                # 오늘 일정에 대한 진행 상태 조회
                progress_records = UserBibleProgress.objects.filter(
                    subscription=subscription,
                    schedule__in=schedules
                )
                
                # schedule_id를 키로 하는 progress 딕셔너리 생성
                progress_dict = {
                    record.schedule_id: record.is_completed 
                    for record in progress_records
                }
        
        # 응답 데이터 구성
        schedule_data = []
        for schedule in schedules:
            data = {
                'id': schedule.id,
                'book': schedule.book,
                'book_code': book_to_code.get(schedule.book, 'gen'),
                'start_chapter': schedule.start_chapter,
                'end_chapter': schedule.end_chapter,
                'audio_link': schedule.audio_link,
                'guide_link': schedule.guide_link,
                'is_completed': progress_dict.get(schedule.id, False)
            }
            schedule_data.append(data)
        
        return Response({
            'success': True,
            'schedules': schedule_data
        })
        
    except Exception as e:
        logger.error(f"Error in get_today_schedules: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_plans(request):
    """사용자의 구독 중인 플랜과 구독 가능한 플랜 목록 반환"""
    try:
        # 1. 사용자가 구독 중인 모든 플랜 목록 조회 (숨김 포함, 활성 먼저)
        all_subscriptions = PlanSubscription.objects.filter(
            user=request.user
        ).select_related('plan').order_by('-is_active', '-plan__is_default')

        # 2. 구독 가능한 플랜 목록 조회 (모든 구독 중인 플랜 제외, 활성 여부 상관없이)
        subscribed_plan_ids = all_subscriptions.values_list('plan_id', flat=True)

        available_plans = BibleReadingPlan.objects.filter(
            is_active=True
        ).exclude(
            id__in=subscribed_plan_ids
        )

        # 3. 시리얼라이징 (숨김 플랜 포함)
        subscription_serializer = PlanSubscriptionSerializer(all_subscriptions, many=True)
        available_plan_serializer = BibleReadingPlanSerializer(available_plans, many=True)

        return Response({
            'subscriptions': subscription_serializer.data,
            'available_plans': available_plan_serializer.data
        })
        
    except Exception as e:
        logger.error(f"Error in get_user_plans: {str(e)}", exc_info=True)
        return Response({'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_available_plans(request):
    """모든 활성화된 읽기 플랜 목록 반환 (그룹 생성 등에 사용)"""
    try:
        plans = BibleReadingPlan.objects.filter(is_active=True).order_by('-is_default', 'name')
        serializer = BibleReadingPlanSerializer(plans, many=True)
        return Response({
            'success': True,
            'plans': serializer.data
        })
    except Exception as e:
        logger.error(f"Error in get_available_plans: {str(e)}", exc_info=True)
        return Response({'success': False, 'error': '요청 처리 중 오류가 발생했습니다.'}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_next_reading_position(request):
    """
    다음 읽을 위치를 반환하는 API
    
    - 비로그인 사용자: 오늘 날짜 또는 가장 가까운 일정 반환
    - 로그인 사용자: 미완료 스케줄 중 첫 번째 반환
    
    [필수 파라미터]
    - plan_id: 플랜 ID
    
    [응답 예시]
    {
        "success": true,
        "status": "next_incomplete",  // 상태 코드
        "month": 3,
        "schedule_id": "123",
        "date": "2024-03-15"
    }
    
    [status 값]
    - "next_incomplete": 다음 미완료 일정
    - "all_completed": 모든 일정 완료
    - "today": 오늘 날짜 일정 (비로그인)
    - "nearest": 가장 가까운 일정 (비로그인, 오늘 일정 없을 때)
    - "no_schedule": 플랜에 일정이 없음
    """
    try:
        plan_id = request.query_params.get('plan_id')
        
        if not plan_id:
            return Response({
                'success': False,
                'status': 'missing_plan_id',
                'message': '플랜 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 플랜 존재 확인
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return Response({
                'success': False,
                'status': 'plan_not_found',
                'message': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        today = timezone.now().date()
        user = request.user
        
        # 비로그인 사용자: 오늘 날짜 또는 가장 가까운 일정 반환
        if not user.is_authenticated:
            # 오늘 일정 확인
            today_schedule = DailyBibleSchedule.objects.filter(
                plan_id=plan_id,
                date=today
            ).first()
            
            if today_schedule:
                return Response({
                    'success': True,
                    'status': 'today',
                    'month': today.month,
                    'schedule_id': today_schedule.id,
                    'date': today.isoformat()
                })
            
            # 오늘 일정 없으면 가장 가까운 미래 일정
            next_schedule = DailyBibleSchedule.objects.filter(
                plan_id=plan_id,
                date__gte=today
            ).order_by('date').first()
            
            if next_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': next_schedule.date.month,
                    'schedule_id': next_schedule.id,
                    'date': next_schedule.date.isoformat()
                })
            
            # 미래 일정도 없으면 가장 마지막 일정
            last_schedule = DailyBibleSchedule.objects.filter(
                plan_id=plan_id
            ).order_by('-date').first()
            
            if last_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': last_schedule.date.month,
                    'schedule_id': last_schedule.id,
                    'date': last_schedule.date.isoformat()
                })
            
            return Response({
                'success': False,
                'status': 'no_schedule',
                'message': '플랜에 등록된 일정이 없습니다.'
            })
        
        # 로그인 사용자: 구독 확인 후 미완료 스케줄 반환
        subscription = PlanSubscription.objects.filter(
            user=user,
            plan_id=plan_id,
            is_active=True
        ).first()
        
        if not subscription:
            # 구독 없으면 비로그인과 동일하게 처리
            today_schedule = DailyBibleSchedule.objects.filter(
                plan_id=plan_id,
                date=today
            ).first()
            
            if today_schedule:
                return Response({
                    'success': True,
                    'status': 'today',
                    'month': today.month,
                    'schedule_id': today_schedule.id,
                    'date': today.isoformat()
                })
            
            next_schedule = DailyBibleSchedule.objects.filter(
                plan_id=plan_id,
                date__gte=today
            ).order_by('date').first()
            
            if next_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': next_schedule.date.month,
                    'schedule_id': next_schedule.id,
                    'date': next_schedule.date.isoformat()
                })
            
            last_schedule = DailyBibleSchedule.objects.filter(
                plan_id=plan_id
            ).order_by('-date').first()
            
            if last_schedule:
                return Response({
                    'success': True,
                    'status': 'nearest',
                    'month': last_schedule.date.month,
                    'schedule_id': last_schedule.id,
                    'date': last_schedule.date.isoformat()
                })
            
            return Response({
                'success': False,
                'status': 'no_schedule',
                'message': '플랜에 등록된 일정이 없습니다.'
            })
        
        # 구독 있는 로그인 사용자: 미완료 스케줄 찾기
        completed_schedule_ids = UserBibleProgress.objects.filter(
            subscription=subscription,
            is_completed=True
        ).values_list('schedule_id', flat=True)
        
        next_schedule = DailyBibleSchedule.objects.filter(
            plan_id=plan_id
        ).exclude(
            id__in=completed_schedule_ids
        ).order_by('date').first()
        
        if next_schedule:
            return Response({
                'success': True,
                'status': 'next_incomplete',
                'month': next_schedule.date.month,
                'schedule_id': next_schedule.id,
                'date': next_schedule.date.isoformat()
            })
        
        # 모든 스케줄 완료
        # 마지막 스케줄 날짜 반환 (UI에서 스크롤 위치용)
        last_schedule = DailyBibleSchedule.objects.filter(
            plan_id=plan_id
        ).order_by('-date').first()
        
        if last_schedule:
            return Response({
                'success': True,
                'status': 'all_completed',
                'month': last_schedule.date.month,
                'schedule_id': last_schedule.id,
                'date': last_schedule.date.isoformat(),
                'message': '모든 일정을 완료했습니다!'
            })
        
        return Response({
            'success': False,
            'status': 'no_schedule',
            'message': '플랜에 등록된 일정이 없습니다.'
        })
        
    except Exception as e:
        logger.error(f"Error in get_next_reading_position: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'status': 'error',
            'message': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def video_intro_list(request):
    """영상 개론 목록 조회 및 생성
    GET: 비로그인 사용자도 접근 가능
    POST: 관리자만 접근 가능
    """
    if request.method == 'GET':
        logger.info(f"[디버그] 영상 개론 목록 조회 - 인증상태: {request.user.is_authenticated}")
        plan_id = request.query_params.get('plan_id')
        
        try:
            if plan_id:
                # plan_id를 정수로 변환
                plan_id = int(plan_id) if plan_id else None
                if plan_id:
                    video_intros = VideoBibleIntro.objects.filter(plan_id=plan_id)
                else:
                    video_intros = VideoBibleIntro.objects.all()
            else:
                video_intros = VideoBibleIntro.objects.all()
                
            logger.info(f"[디버그] 조회된 영상 개론 개수: {video_intros.count()}, plan_id: {plan_id}")
            serializer = VideoBibleIntroSerializer(video_intros, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"[디버그] 영상 개론 목록 조회 오류: {str(e)}", exc_info=True)
            return Response(
                {"detail": "요청 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':
        # 인증 확인
        if not request.user.is_authenticated:
            return Response(
                {"detail": "인증이 필요합니다."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        # 관리자 권한 확인
        if not request.user.is_staff:
            return Response(
                {"detail": "관리자 권한이 필요합니다."}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        serializer = VideoBibleIntroSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'DELETE'])
@permission_classes([AllowAny])
def video_intro_detail(request, pk):
    """영상 개론 상세 조회 및 삭제
    GET: 비로그인 사용자도 접근 가능
    DELETE: 관리자만 접근 가능
    """
    try:
        video_intro = VideoBibleIntro.objects.get(pk=pk)
    except VideoBibleIntro.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    # GET 요청은 모든 사용자 접근 가능 (비로그인 포함)
    if request.method == 'GET':
        logger.info(f"[디버그] 영상 개론 상세 조회 - ID: {pk}, 인증상태: {request.user.is_authenticated}")
        serializer = VideoBibleIntroSerializer(video_intro)
        return Response(serializer.data)
    
    # DELETE 요청은 관리자만 가능
    elif request.method == 'DELETE':
        # 인증 확인
        if not request.user.is_authenticated:
            return Response(
                {"detail": "인증이 필요합니다."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        # 관리자 권한 확인
        if not request.user.is_staff:
            return Response(
                {"detail": "관리자 권한이 필요합니다."}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        video_intro.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def upload_video_intros(request):
    """엑셀 파일로 영상 개론 일괄 업로드"""
    try:
        plan_id = request.data.get('plan_id')
        file = request.FILES.get('file')
        
        # 기본 유효성 검사
        if not plan_id or not file:
            return Response(
                {'detail': '플랜 ID와 엑셀 파일이 필요합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 파일 확장자 확인
        file_name = file.name.lower()
        if not (file_name.endswith('.xlsx') or file_name.endswith('.xls')):
            return Response(
                {'detail': 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 파일 크기 제한 (5MB)
        if file.size > 5 * 1024 * 1024:
            return Response(
                {'detail': '파일 크기는 5MB를 초과할 수 없습니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 플랜 존재 여부 확인
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {'detail': '존재하지 않는 플랜입니다.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 엑셀 파일 읽기
        try:
            # 날짜 컬럼을 자동으로 datetime 객체로 변환
            df = pd.read_excel(file, parse_dates=['시작일', '종료일'])
            logger.info(f"엑셀 파일 로드 성공: {len(df)} 행")

            # 첫 5행 데이터 샘플 로깅
            if not df.empty:
                logger.debug(f"샘플 데이터 (첫 5행):\n{df.head().to_dict('records')}")

            # 각 열의 데이터 유형 로깅
            dtypes = df.dtypes.to_dict()
            logger.debug(f"컬럼 데이터 유형: {dtypes}")
        except Exception as e:
            logger.error(f"엑셀 파일 읽기 오류: {str(e)}", exc_info=True)
            return Response(
                {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 필수 컬럼 확인
        required_columns = ['시작일', '종료일', '성경', 'URL']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return Response(
                {'detail': f'다음 필수 컬럼이 없습니다: {", ".join(missing_columns)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 데이터 처리 및 저장
        created_count = 0
        updated_count = 0
        errors = []
        
        # 한국어 날짜 패턴 정규식
        date_pattern = r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일'
        
        with transaction.atomic():
            for index, row in df.iterrows():
                try:
                    row_number = index + 2  # 엑셀 행 번호 (헤더 제외)
                    
                    # 값이 비어있는지 확인
                    if pd.isna(row['시작일']) or pd.isna(row['종료일']) or pd.isna(row['성경']) or pd.isna(row['URL']):
                        errors.append(f"{row_number}행: 빈 값이 있습니다.")
                        continue
                    
                    # 날짜 문자열 가져오기
                    start_date_str = str(row['시작일']).strip()
                    end_date_str = str(row['종료일']).strip()
                    
                    # 날짜 파싱 함수
                    def parse_korean_date(date_str):
                        # pandas datetime 객체인 경우 (엑셀 날짜 셀)
                        if isinstance(date_str, pd.Timestamp):
                            return date_str.date()
                        
                        # 날짜형으로 직접 변환 시도 (pd.to_datetime은 다양한 형식 지원)
                        try:
                            return pd.to_datetime(date_str).date()
                        except:
                            pass
                        
                        # YYYY-MM-DD HH:MM:SS 형식인 경우
                        if re.match(r'\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}', date_str):
                            try:
                                return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S').date()
                            except ValueError:
                                pass
                            
                        # YYYY-MM-DD 형식인 경우
                        if re.match(r'\d{4}-\d{1,2}-\d{1,2}', date_str):
                            return parse_date(date_str)
                            
                        # YYYY년 MM월 DD일 형식인 경우
                        matches = re.search(date_pattern, date_str)
                        if matches:
                            year = int(matches.group(1))
                            month = int(matches.group(2))
                            day = int(matches.group(3))
                            return datetime(year, month, day).date()
                        
                        # 다른 형식 시도
                        try:
                            # 다양한 날짜 형식 파싱 시도
                            for fmt in ['%Y년 %m월 %d일', '%Y년%m월%d일', '%Y-%m-%d', '%Y/%m/%d']:
                                try:
                                    return datetime.strptime(date_str, fmt).date()
                                except ValueError:
                                    continue
                        except Exception:
                            pass
                            
                        # 모든 시도 실패
                        return None
                    
                    # 날짜 파싱
                    start_date = parse_korean_date(start_date_str)
                    end_date = parse_korean_date(end_date_str)
                    
                    # 파싱 실패 시 오류
                    if not start_date:
                        errors.append(f"{row_number}행: 시작일 형식이 올바르지 않습니다. ({start_date_str})")
                        continue
                        
                    if not end_date:
                        errors.append(f"{row_number}행: 종료일 형식이 올바르지 않습니다. ({end_date_str})")
                        continue
                    
                    # 날짜 유효성 검사
                    if end_date < start_date:
                        errors.append(f"{row_number}행: 종료일({end_date})이 시작일({start_date})보다 이전입니다.")
                        continue
                    
                    # 성경 이름 가져오기
                    book_name = str(row['성경']).strip()
                    if not book_name:
                        errors.append(f"{row_number}행: 성경 이름이 비어있습니다.")
                        continue
                        
                    # URL 유효성 검사
                    url = str(row['URL']).strip()
                    if not (url.startswith('http://') or url.startswith('https://')):
                        errors.append(f"{row_number}행: URL 형식이 올바르지 않습니다. ({url})")
                        continue
                    
                    # 중복 확인 (성경 이름과 플랜으로)
                    existing = VideoBibleIntro.objects.filter(
                        plan=plan,
                        book=book_name
                    ).first()
                    
                    logger.debug(f"처리 중: {book_name}, 시작일: {start_date}, 종료일: {end_date}, URL: {url}")
                    
                    if existing:
                        # 기존 데이터 업데이트
                        existing.start_date = start_date
                        existing.end_date = end_date
                        existing.url_link = url
                        existing.save()
                        updated_count += 1
                        logger.info(f"업데이트: {book_name}")
                    else:
                        # 새 데이터 생성
                        VideoBibleIntro.objects.create(
                            plan=plan,
                            book=book_name,
                            start_date=start_date,
                            end_date=end_date,
                            url_link=url
                        )
                        created_count += 1
                        logger.info(f"생성: {book_name}")
                        
                except Exception as e:
                    logger.error(f"{index+2}행 처리 중 오류: {str(e)}", exc_info=True)
                    errors.append(f"{index+2}행: 처리 중 오류가 발생했습니다.")
        
        # 결과 반환
        result = {
            'detail': f'{created_count}개 생성, {updated_count}개 업데이트 완료'
        }
        
        if errors:
            result['errors'] = errors
            
        return Response(result, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"업로드 처리 중 예외 발생: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def get_user_video_intros(request):
    """사용자가 구독 중인 플랜의 영상 개론 목록 조회
    로그인 정보가 없는 경우 파라미터로 받은 플랜의 전체 일정 반환
    """
    try:
        # 로그인 여부 확인
        if request.user.is_authenticated:
            # 로그인된 경우 - 사용자가 구독 중인 플랜 ID 목록
            plan_ids = list(PlanSubscription.objects.filter(
                user=request.user,
                is_active=True
            ).values_list('plan_id', flat=True))
            
            # plan_id 파라미터가 있으면 해당 플랜만 필터링 (구독 중인 플랜인지 확인)
            requested_plan_id = request.GET.get('plan_id')
            if requested_plan_id:
                try:
                    requested_plan_id = int(requested_plan_id)
                    if requested_plan_id in plan_ids:
                        plan_ids = [requested_plan_id]
                    # 구독하지 않은 플랜이면 무시하고 전체 구독 플랜 표시
                except (ValueError, TypeError):
                    pass
            
            # 해당 플랜의 영상 개론 목록 조회
            video_intros = VideoBibleIntro.objects.filter(
                plan_id__in=plan_ids
            ).order_by('start_date')
            
            # 추가: 사용자의 진행 상태 조회
            progress_records = UserVideoIntroProgress.objects.filter(
                user=request.user,
                video_intro__in=video_intros
            ).select_related('video_intro')
        else:
            # 비로그인 경우 - 파라미터로 받은 플랜의 전체 일정 반환
            plan_id = request.GET.get('plan_id')
            logger.info(f"[디버그] 비로그인 사용자 요청 - 파라미터 plan_id: {plan_id}")
            
            try:
                # plan_id를 정수로 변환, 없으면 기본 플랜 사용
                if plan_id:
                    plan_id = int(plan_id)
                else:
                    default_plan = BibleReadingPlan.objects.filter(is_default=True).first()
                    plan_id = default_plan.id if default_plan else None
            except (ValueError, TypeError):
                # 변환 오류 발생 시 기본 플랜 사용
                logger.warning(f"[디버그] plan_id 변환 오류, 기본 플랜 조회: {plan_id}")
                default_plan = BibleReadingPlan.objects.filter(is_default=True).first()
                plan_id = default_plan.id if default_plan else None
            
            # 해당 플랜의 영상 개론 목록 조회
            logger.info(f"[디버그] 비로그인 사용자 영상 개론 조회 - plan_id: {plan_id}")
            video_intros = VideoBibleIntro.objects.filter(
                plan_id=plan_id
            ).order_by('start_date')
            
            # 조회된 개론 영상 개수 로깅
            logger.info(f"[디버그] 조회된 개론 영상 개수: {video_intros.count()}")
            
            # 비로그인 사용자는 진행 상태가 없음
            progress_records = []
        
        # video_intro_id를 키로 하는 progress 딕셔너리 생성
        progress_dict = {
            record.video_intro_id: {
                'is_completed': record.is_completed,
                'completed_at': record.completed_at
            } 
            for record in progress_records
        }
        
        # 응답 데이터 구성
        result = []
        
        # 로그인된 경우에만 진행 상태 딕셔너리 생성
        if request.user.is_authenticated:
            # video_intro_id를 키로 하는 progress 딕셔너리 생성
            progress_dict = {
                record.video_intro_id: {
                    'is_completed': record.is_completed,
                    'completed_at': record.completed_at
                } 
                for record in progress_records
            }
            
            for intro in video_intros:
                intro_data = VideoBibleIntroSerializer(intro).data
                # 사용자 진행 상태 추가
                if intro.id in progress_dict:
                    intro_data['is_completed'] = progress_dict[intro.id]['is_completed']
                    intro_data['completed_at'] = progress_dict[intro.id]['completed_at']
                else:
                    intro_data['is_completed'] = False
                    intro_data['completed_at'] = None
                
                result.append(intro_data)
        else:
            # 비로그인 사용자는 모든 항목이 미완료 상태
            for intro in video_intros:
                intro_data = VideoBibleIntroSerializer(intro).data
                intro_data['is_completed'] = False
                intro_data['completed_at'] = None
                result.append(intro_data)
        
        return Response(result)
        
    except Exception as e:
        logger.error(f"[디버그] 영상 개론 목록 조회 오류: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def hasena_record_list(request):
    """하세나 기록 목록 조회 및 생성"""
    if request.method == 'GET':
        # 날짜 필터링 (선택적)
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        records = HasenaRecord.objects.filter(user=request.user)
        
        if year:
            records = records.filter(date__year=year)
        if month:
            records = records.filter(date__month=month)
            
        # 날짜 내림차순 정렬
        records = records.order_by('-date')
        
        # 간단한 직렬화 (모델이 단순하므로 별도 시리얼라이저 없이 처리)
        data = [{
            'id': record.id,
            'date': record.date.isoformat(),
            'is_completed': record.is_completed,
            'created_at': record.created_at.isoformat()
        } for record in records]
        
        return Response(data)
    
    elif request.method == 'POST':
        # 날짜 필수 확인
        date_str = request.data.get('date')
        if not date_str:
            return Response(
                {'detail': '날짜가 필요합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # 날짜 형식 변환
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # 중복 확인
            existing = HasenaRecord.objects.filter(
                user=request.user,
                date=date
            ).first()
            
            if existing:
                # 기존 기록 업데이트
                existing.is_completed = request.data.get('is_completed', True)
                existing.save()
                
                return Response({
                    'id': existing.id,
                    'date': existing.date.isoformat(),
                    'is_completed': existing.is_completed,
                    'created_at': existing.created_at.isoformat(),
                    'updated_at': existing.updated_at.isoformat()
                })
            
            # 새 기록 생성
            record = HasenaRecord.objects.create(
                user=request.user,
                date=date,
                is_completed=request.data.get('is_completed', True)
            )
            
            return Response({
                'id': record.id,
                'date': record.date.isoformat(),
                'is_completed': record.is_completed,
                'created_at': record.created_at.isoformat(),
                'updated_at': record.updated_at.isoformat()
            }, status=status.HTTP_201_CREATED)
            
        except ValueError:
            return Response(
                {'detail': '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error in hasena_record_list: {str(e)}", exc_info=True)
            return Response(
                {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def hasena_record_detail(request, pk):
    """하세나 기록 상세 조회 및 삭제"""
    try:
        record = HasenaRecord.objects.get(pk=pk, user=request.user)
    except HasenaRecord.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        data = {
            'id': record.id,
            'date': record.date.isoformat(),
            'is_completed': record.is_completed,
            'created_at': record.created_at.isoformat(),
            'updated_at': record.updated_at.isoformat()
        }
        return Response(data)
    
    elif request.method == 'DELETE':
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_video_intro_progress(request):
    """영상 개론 진행 상황 업데이트"""
    try:
        video_intro_id = request.data.get('video_intro_id')
        is_completed = request.data.get('is_completed', True)
        
        if not video_intro_id:
            return Response(
                {'detail': '영상 개론 ID가 필요합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 영상 개론 존재 여부 확인
        try:
            video_intro = VideoBibleIntro.objects.get(id=video_intro_id)
        except VideoBibleIntro.DoesNotExist:
            return Response(
                {'detail': '존재하지 않는 영상 개론입니다.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
            
        # 진행 상황 업데이트 또는 생성
        progress, created = UserVideoIntroProgress.objects.update_or_create(
            user=request.user,
            video_intro=video_intro,
            defaults={
                'is_completed': is_completed,
                'completed_at': timezone.now() if is_completed else None
            }
        )
        
        return Response({
            'id': progress.id,
            'video_intro_id': video_intro.id,
            'is_completed': progress.is_completed,
            'completed_at': progress.completed_at.isoformat() if progress.completed_at else None
        })
        
    except Exception as e:
        logger.error(f"Error in update_video_intro_progress: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def plan_subscription_unsubscribe(request, pk):
    """
    구독 취소 및 관련 진행도 데이터 삭제
    """
    try:
        subscription = PlanSubscription.objects.get(pk=pk, user=request.user)
    except PlanSubscription.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    # 기본 플랜 구독은 취소할 수 없음
    if subscription.plan.is_default:
        return Response(
            {"detail": "기본 플랜 구독은 취소할 수 없습니다."}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 플랜 정보 저장 (응답에 사용)
    plan_name = subscription.plan.name
    
    with transaction.atomic():
        # 1. 해당 구독에 연결된 모든 진행도 데이터 삭제
        UserBibleProgress.objects.filter(subscription=subscription).delete()
        
        # 2. 해당 구독에 연결된 영상 개론 진행 데이터 삭제
        UserVideoIntroProgress.objects.filter(
            user=request.user,
            video_intro__plan=subscription.plan
        ).delete()
        
        # 3. 구독 레코드 완전 삭제 (비활성화 대신)
        subscription.delete()
    
    return Response({"detail": f"{plan_name} 플랜 구독이 취소되었습니다."})

@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def schedule_list(request):
    """스케줄 목록 조회 및 생성"""
    if request.method == 'GET':
        plan_id = request.query_params.get('plan_id')
        if plan_id:
            schedules = DailyBibleSchedule.objects.filter(plan_id=plan_id)
        else:
            schedules = DailyBibleSchedule.objects.all()
        serializer = DailyBibleScheduleSerializer(schedules, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다."}, status=403)
            
        serializer = DailyBibleScheduleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def schedule_detail(request, pk):
    """스케줄 상세 조회/수정/삭제"""
    try:
        schedule = DailyBibleSchedule.objects.get(pk=pk)
    except DailyBibleSchedule.DoesNotExist:
        return Response(status=404)
        
    if request.method == 'GET':
        serializer = DailyBibleScheduleSerializer(schedule)
        return Response(serializer.data)
        
    elif request.method in ['PUT', 'PATCH']:
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다."}, status=403)
            
        serializer = DailyBibleScheduleSerializer(schedule, data=request.data, partial=request.method=='PATCH')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)
        
    elif request.method == 'DELETE':
        if not request.user.is_staff:
            return Response({"detail": "권한이 없습니다."}, status=403)
            
        schedule.delete()
        return Response(status=204)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, permissions.IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def upload_schedules_excel(request):
    """엑셀 파일로 세부 일정 대량 업로드"""
    try:
        plan_id = request.data.get('plan_id')
        file = request.FILES.get('file')
        update_mode = request.data.get('update_mode', 'add')  # 'add', 'update', 'replace'
        
        if not plan_id or not file:
            return Response(
                {"detail": "플랜 ID와 파일은 필수 항목입니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 파일 확장자 확인
        file_name = file.name.lower()
        if not (file_name.endswith('.xlsx') or file_name.endswith('.xls')):
            return Response(
                {"detail": "Excel 파일(.xlsx, .xls)만 업로드 가능합니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # 파일 크기 제한 (5MB)
        if file.size > 5 * 1024 * 1024:
            return Response(
                {"detail": "파일 크기는 5MB를 초과할 수 없습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 플랜 존재 여부 확인
            plan = BibleReadingPlan.objects.get(id=plan_id)
            
            # 엑셀 파일 읽기
            import pandas as pd
            import re
            from datetime import datetime
            
            # 날짜 컬럼을 자동으로 datetime 객체로 변환
            df = pd.read_excel(file)
            
            # 필수 열 확인
            required_columns = ['날짜', '성경', '시작장', '끝장']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {"detail": f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 기존 일정 관리
            if update_mode == 'replace':
                # 기존 일정 모두 삭제
                DailyBibleSchedule.objects.filter(plan=plan).delete()
            
            # 데이터 변환 및 저장
            success_count = 0
            error_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # 날짜 변환
                    date_str = row['날짜']
                    if isinstance(date_str, str):
                        # YYYY-MM-DD 형식이 아닌 경우 변환
                        if re.match(r'\d{4}\.\d{1,2}\.\d{1,2}', date_str):
                            date_str = date_str.replace('.', '-')
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                    else:
                        # pandas가 자동으로 datetime으로 변환한 경우
                        date_obj = date_str.date() if hasattr(date_str, 'date') else date_str
                    
                    # 필드 값 추출
                    book = row['성경']
                    start_chapter = int(row['시작장'])
                    end_chapter = int(row['끝장'])
                    
                    # URL 필드 처리 개선
                    audio_link = row.get('오디오', '')
                    guide_link = row.get('가이드', '')

                    # 데이터 타입 확인 및 변환 
                    # float 타입이 들어온 경우 처리
                    if isinstance(audio_link, float) or isinstance(guide_link, float):
                        if pd.isna(audio_link):
                            audio_link = ''
                        if pd.isna(guide_link):
                            guide_link = ''
                    
                    # 업데이트 모드 처리
                    if update_mode in ['add', 'replace']:
                        # 신규 추가
                        DailyBibleSchedule.objects.create(
                            plan=plan,
                            date=date_obj,
                            book=book,
                            start_chapter=start_chapter,
                            end_chapter=end_chapter,
                            audio_link=audio_link,
                            guide_link=guide_link
                        )
                    else:  # update 모드
                        # 기존 레코드 업데이트 또는 생성
                        obj, created = DailyBibleSchedule.objects.update_or_create(
                            plan=plan,
                            date=date_obj,
                            defaults={
                                'book': book,
                                'start_chapter': start_chapter,
                                'end_chapter': end_chapter,
                                'audio_link': audio_link,
                                'guide_link': guide_link
                            }
                        )
                    
                    success_count += 1
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error in upload_schedules_excel row {index + 2}: {str(e)}", exc_info=True)
                    errors.append(f"행 {index + 2}: 처리 중 오류가 발생했습니다.")
            
            return Response({
                "detail": f"{success_count}개의 일정이 처리되었습니다. 오류: {error_count}개",
                "errors": errors if errors else None
            })
            
        except BibleReadingPlan.DoesNotExist:
            return Response(
                {"detail": "해당 ID의 플랜을 찾을 수 없습니다."}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error in upload_schedules_excel: {str(e)}", exc_info=True)
            return Response(
                {"detail": "요청 처리 중 오류가 발생했습니다."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        logger.error(f"Error in upload_schedules_excel request: {str(e)}", exc_info=True)
        return Response(
            {"detail": "요청 처리 중 오류가 발생했습니다."}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([AllowAny])  # IsAuthenticated에서 AllowAny로 변경
def get_total_users(request):
    """전체 참여자 수 조회"""
    try:
        plan_id = request.query_params.get('plan_id')
        
        if plan_id:
            # 특정 플랜의 활성 구독자 수 반환
            total_users = PlanSubscription.objects.filter(
                plan_id=plan_id,
                is_active=True
            ).count()
        else:
            # 전체 사용자 수 반환
            total_users = User.objects.filter(is_active=True).count()
            
        return Response({
            'success': True,
            'total_users': total_users
        })
    except Exception as e:
        logger.error(f"Error in get_total_users: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])  # IsAuthenticated, IsAdminUser에서 AllowAny로 변경
def get_plan_stats(request):
    """플랜별 통계 조회"""
    try:
        plan_id = request.query_params.get('plan_id')
        if not plan_id:
            return Response({
                'success': False,
                'error': '플랜 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        plan = get_object_or_404(BibleReadingPlan, id=plan_id)
        today = timezone.now().date()

        # 해당 플랜의 활성 구독자 수
        total_subscribers = PlanSubscription.objects.filter(
            plan=plan,
            is_active=True
        ).count()

        # 오늘의 일정
        today_schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date=today
        )

        # 오늘 일정을 완료한 사용자 수
        completed_users = set()
        for schedule in today_schedules:
            completed_users.update(
                UserBibleProgress.objects.filter(
                    schedule=schedule,
                    is_completed=True,
                    subscription__plan=plan,
                    subscription__is_active=True
                ).values_list('subscription__user_id', flat=True)
            )

        return Response({
            'success': True,
            'plan_name': plan.name,
            'today_completed_users': len(completed_users)
        })
    except Exception as e:
        logger.error(f"Error in get_plan_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])  # IsAuthenticated에서 AllowAny로 변경
def get_progress_stats(request):
    """
    진행률 통계 정보를 반환하는 API
    
    [필수 파라미터]
    - plan_id: 플랜 ID
    
    [응답 예시]
    {
        "success": true,
        "plan_name": "1년 성경 통독",
        "theoretical_progress": 23.45,  // 오늘까지 완료했을 때의 이론적 진행률 (%)
        "user_progress": 18.32          // 사용자의 실제 진행률 (%)
    }
    """
    try:
        plan_id = request.query_params.get('plan_id')
        
        if not plan_id:
            # 기본 플랜 ID를 사용 (추가)
            default_plan = BibleReadingPlan.objects.filter(is_default=True).first()
            if default_plan:
                plan_id = default_plan.id
            else:
                return Response({
                    'success': False,
                    'error': '플랜 ID가 필요합니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        # 플랜 존재 여부 확인
        try:
            plan = BibleReadingPlan.objects.get(id=plan_id)
        except BibleReadingPlan.DoesNotExist:
            return Response({
                'success': False,
                'error': '존재하지 않는 플랜입니다.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 오늘 날짜 가져오기
        today = timezone.now().date()
        
        # 1. 전체 일정 개수 계산
        total_schedules = DailyBibleSchedule.objects.filter(plan=plan).count()
        
        if total_schedules == 0:
            return Response({
                'success': False,
                'error': '이 플랜에는 일정이 없습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 2. 오늘까지의 일정 개수 계산
        today_schedules = DailyBibleSchedule.objects.filter(
            plan=plan,
            date__lte=today
        ).count()
        
        # 3. 이론적 진행률 계산 (오늘까지 완료했을 때)
        theoretical_progress = (today_schedules / total_schedules) * 100
        
        # 4. 사용자가 로그인 상태인지 확인
        user_progress = 0
        if request.user.is_authenticated:
            # 사용자의 구독 확인
            subscription = PlanSubscription.objects.filter(
                user=request.user,
                plan=plan,
                is_active=True
            ).first()
            
            if subscription:
                # 사용자가 완료한 일정 개수 계산
                completed_schedules = UserBibleProgress.objects.filter(
                    subscription=subscription,
                    is_completed=True
                ).count()
                
                # 사용자 진행률 계산
                user_progress = (completed_schedules / total_schedules) * 100
        
        return Response({
            'success': True,
            'plan_name': plan.name,
            'theoretical_progress': round(theoretical_progress, 2),
            'user_progress': round(user_progress, 2)
        })
        
    except Exception as e:
        logger.error(f"Error in get_progress_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def increment_visitor_count(request):
    """방문자 수 증가"""
    try:
        # 세션에서 마지막 방문 날짜 확인
        last_visit = request.session.get('last_visit')
        
        # localtime() 대신 timezone.now()를 사용하여 aware datetime 얻기
        today = timezone.now().date().isoformat()

        # 오늘 이미 방문했다면 카운트하지 않음
        if last_visit == today:
            today_count = VisitorCount.objects.filter(date=timezone.now().date()).first()
            return Response({
                'success': True,
                'daily_count': today_count.daily_count if today_count else 0,
                'counted': False
            })

        # 오늘 첫 방문이면 카운트 증가
        visitor_count = VisitorCount.increment_daily_count()

        # 세션에 마지막 방문 날짜 저장
        request.session['last_visit'] = today

        return Response({
            'success': True,
            'daily_count': visitor_count.daily_count,
            'counted': True
        })
    except Exception as e:
        logger.error(f"Error in increment_visitor_count: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_visitor_stats(request):
    """방문자 통계 조회"""
    try:
        today = timezone.now().date()
        today_count = VisitorCount.objects.filter(date=today).first()
        daily_visitors = today_count.daily_count if today_count else 0
        total_visitors = VisitorCount.get_total_visitors()

        return Response({
            'success': True,
            'daily_visitors': daily_visitors,
            'total_visitors': total_visitors
        })
    except Exception as e:
        logger.error(f"Error in get_visitor_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hasena_record_update(request):
    """하세나하시조 완료/취소 처리"""
    try:
        date_str = request.data.get('date')
        is_completed = request.data.get('is_completed', True)

        if not date_str:
            return Response(
                {'detail': '날짜가 필요합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 날짜 형식 변환
            date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # 중복 확인 및 업데이트/생성
            record, created = HasenaRecord.objects.update_or_create(
                user=request.user,
                date=date,
                defaults={
                    'is_completed': is_completed
                }
            )
            
            return Response({
                'success': True,
                'data': {
                    'id': record.id,
                    'date': record.date.isoformat(),
                    'is_completed': record.is_completed,
                    'created_at': record.created_at.isoformat(),
                    'updated_at': record.updated_at.isoformat()
                }
            })
            
        except ValueError:
            return Response(
                {'detail': '날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식이어야 합니다.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except Exception as e:
        logger.error(f"Error in hasena_record_update: {str(e)}", exc_info=True)
        return Response(
            {'detail': '요청 처리 중 오류가 발생했습니다.'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_hasena_status(request):
    """현재 사용자의 하세나 완료 상태 조회"""
    try:
        # 오늘 날짜 가져오기
        today = timezone.now().date()
        
        # 오늘의 하세나 기록 조회
        record = HasenaRecord.objects.filter(
            user=request.user,
            date=today
        ).first()
        
        return Response({
            'success': True,
            'data': {
                'id': record.id if record else None,
                'date': today.isoformat(),
                'is_completed': record.is_completed if record else False
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_user_hasena_status: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요청 처리 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def get_hasena_summary(request):
    video_id = request.query_params.get('video_id')
    video_date = request.query_params.get('date')
    generate = request.query_params.get('generate', 'false').lower() == 'true'
    
    if not video_id:
        return Response({
            'success': False,
            'error': 'video_id 파라미터가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if generate and not (request.user.is_authenticated and request.user.is_staff):
        return Response({
            'success': False,
            'error': '요약 생성은 관리자만 가능합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        from .services.hasena_summary_service import get_hasena_summary as fetch_summary, get_existing_summary
        
        parsed_date = None
        if video_date:
            try:
                parsed_date = datetime.strptime(video_date, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        if generate:
            result = fetch_summary(video_id, video_date=parsed_date)
        else:
            result = get_existing_summary(video_id)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        logger.error(f"Error in get_hasena_summary: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': 'AI 요약 조회 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def generate_hasena_summary_from_cron(request):
    cron_secret = getattr(settings, 'CRON_SECRET', None)
    request_secret = request.headers.get('X-Cron-Secret') or request.headers.get('Authorization', '').removeprefix('Bearer ').strip()

    if not cron_secret:
        return Response({
            'success': False,
            'error': 'CRON_SECRET이 설정되어 있지 않습니다.'
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    if request_secret != cron_secret:
        return Response({
            'success': False,
            'error': 'Unauthorized'
        }, status=status.HTTP_401_UNAUTHORIZED)

    video_id = request.data.get('video_id')
    video_date = request.data.get('video_date')
    title = request.data.get('title')

    parsed_date = None
    if video_date:
        try:
            parsed_date = datetime.strptime(video_date, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'error': 'video_date 형식은 YYYY-MM-DD 이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

    try:
        from .services.hasena_summary_service import (
            get_hasena_summary as fetch_summary,
            get_recent_hasena_videos,
        )

        if video_id:
            result = fetch_summary(video_id, video_date=parsed_date, title=title)
            if result['success']:
                return Response(result)
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        candidates = get_recent_hasena_videos()
        if not candidates:
            return Response({
                'success': False,
                'error': '최신 하세나 영상을 찾을 수 없습니다.'
            }, status=status.HTTP_502_BAD_GATEWAY)

        last_result = None
        for candidate in candidates:
            candidate_video_id = candidate.get('video_id')
            if not candidate_video_id:
                continue

            candidate_date = parsed_date
            if not candidate_date and candidate.get('published_at'):
                candidate_date = datetime.fromisoformat(candidate['published_at'].replace('Z', '+00:00')).date()

            result = fetch_summary(
                candidate_video_id,
                video_date=candidate_date,
                title=title or candidate.get('title'),
            )
            if result['success']:
                return Response(result)
            last_result = result

        if not last_result:
            return Response({
                'success': False,
                'error': '최신 하세나 영상을 찾을 수 없습니다.'
            }, status=status.HTTP_502_BAD_GATEWAY)

        return Response(last_result, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error in generate_hasena_summary_from_cron: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': 'AI 요약 생성 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_hasena_summaries(request):
    if not request.user.is_staff:
        return Response({
            'success': False,
            'error': '관리자 권한이 필요합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        from .services.hasena_summary_service import list_summaries
        
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        
        result = list_summaries(page=page, page_size=page_size)
        return Response(result)
        
    except Exception as e:
        logger.error(f"Error in list_hasena_summaries: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요약 목록 조회 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_hasena_summary(request):
    if not request.user.is_staff:
        return Response({
            'success': False,
            'error': '관리자 권한이 필요합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    video_id = request.data.get('video_id')
    if not video_id:
        return Response({
            'success': False,
            'error': 'video_id가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .services.hasena_summary_service import regenerate_summary_for_video
        
        result = regenerate_summary_for_video(video_id)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error in regenerate_hasena_summary: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요약 재생성 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_hasena_summary(request, video_id):
    if not request.user.is_staff:
        return Response({
            'success': False,
            'error': '관리자 권한이 필요합니다.'
        }, status=status.HTTP_403_FORBIDDEN)
    
    summary = request.data.get('summary')
    title = request.data.get('title')
    
    if not summary:
        return Response({
            'success': False,
            'error': 'summary가 필요합니다.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        from .services.hasena_summary_service import update_summary
        
        result = update_summary(video_id, summary=summary, title=title)
        
        if result['success']:
            return Response(result)
        else:
            return Response(result, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        logger.error(f"Error in update_hasena_summary: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '요약 수정 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_hasena_stats(request):
    from datetime import timedelta
    
    try:
        today = timezone.now().date()
        records = HasenaRecord.objects.filter(
            user=request.user,
            is_completed=True
        ).order_by('-date').values_list('date', flat=True)
        
        records_set = set(records)
        total_completed = len(records_set)
        
        current_streak = 0
        check_date = today
        
        while True:
            if check_date.weekday() == 6:
                check_date -= timedelta(days=1)
                continue
            
            if check_date in records_set:
                current_streak += 1
                check_date -= timedelta(days=1)
            elif check_date == today:
                check_date -= timedelta(days=1)
            else:
                break
        
        longest_streak = current_streak
        temp_streak = 0
        sorted_dates = sorted(records_set, reverse=True)
        
        for i, date in enumerate(sorted_dates):
            if i == 0:
                temp_streak = 1
            else:
                prev_date = sorted_dates[i - 1]
                diff = (prev_date - date).days
                
                weekdays_between = 0
                check = date + timedelta(days=1)
                while check <= prev_date:
                    if check.weekday() != 6:
                        weekdays_between += 1
                    check += timedelta(days=1)
                
                if weekdays_between <= 1:
                    temp_streak += 1
                else:
                    temp_streak = 1
            
            longest_streak = max(longest_streak, temp_streak)
        
        return Response({
            'success': True,
            'data': {
                'total_completed': total_completed,
                'current_streak': current_streak,
                'longest_streak': longest_streak
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_hasena_stats: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': '통계를 불러오는 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================
# 성경읽기 기능 API (읽기 위치, 북마크, 묵상노트, 개인 읽기 기록)
# ============================================

from .models import UserReadingPosition, BibleBookmark, ReflectionNote, BibleHighlight, PersonalReadingRecord
from .serializers import (
    UserReadingPositionSerializer,
    BibleBookmarkSerializer,
    ReflectionNoteSerializer,
    BibleHighlightSerializer,
    PersonalReadingRecordSerializer
)
from collections import defaultdict


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reading_position_view(request):
    """마지막 읽기 위치 조회/저장 API"""
    if request.method == 'GET':
        try:
            position = UserReadingPosition.objects.filter(user=request.user).first()
            if position:
                serializer = UserReadingPositionSerializer(position)
                return Response({'success': True, 'position': serializer.data})
            return Response({'success': True, 'position': None})
        except Exception as e:
            logger.error(f"Error in reading_position_view GET: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'detail': '요청 처리 중 오류가 발생했습니다.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    elif request.method == 'POST':
        try:
            position = UserReadingPosition.objects.filter(user=request.user).first()
            serializer = UserReadingPositionSerializer(
                position,
                data=request.data,
                partial=position is not None,
            )
            if serializer.is_valid():
                serializer.save(user=request.user)
                return Response({'success': True, 'message': '위치가 저장되었습니다'})
            return Response({
                'success': False,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error in reading_position_view POST: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'detail': '요청 처리 중 오류가 발생했습니다.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BibleBookmarkViewSet(viewsets.ModelViewSet):
    """북마크 CRUD API"""
    serializer_class = BibleBookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BibleBookmark.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # 중복 북마크 체크
            data = serializer.validated_data
            bookmark_type = data.get('bookmark_type', 'chapter')
            book = data.get('book')
            chapter = data.get('chapter')

            existing_query = self.get_queryset().filter(
                book=book,
                chapter=chapter,
                bookmark_type=bookmark_type
            )

            if bookmark_type == 'verse':
                start_verse = data.get('start_verse')
                end_verse = data.get('end_verse')
                existing_query = existing_query.filter(
                    start_verse=start_verse,
                    end_verse=end_verse
                )

            if existing_query.exists():
                # 이미 존재하는 북마크 반환 (중복 생성 방지)
                existing_bookmark = existing_query.first()
                return Response({
                    'id': existing_bookmark.id,
                    'book': existing_bookmark.book,
                    'chapter': existing_bookmark.chapter,
                    'bookmark_type': existing_bookmark.bookmark_type,
                    'title': existing_bookmark.title,
                    'already_exists': True
                }, status=status.HTTP_200_OK)

            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'success': True, 'message': '북마크가 삭제되었습니다'})

    @action(detail=False, methods=['get'], url_path='by-chapter')
    def by_chapter(self, request):
        """특정 장의 북마크 조회"""
        book = request.query_params.get('book')
        chapter = request.query_params.get('chapter')
        if not book or not chapter:
            return Response({
                'success': False,
                'error': 'book and chapter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            chapter = int(chapter)
        except ValueError:
            return Response({
                'success': False,
                'error': 'chapter must be a number'
            }, status=status.HTTP_400_BAD_REQUEST)

        bookmarks = self.get_queryset().filter(book=book, chapter=chapter)
        serializer = self.get_serializer(bookmarks, many=True)
        return Response({'success': True, 'bookmarks': serializer.data})

    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request):
        """모든 북마크 삭제"""
        count, _ = self.get_queryset().delete()
        return Response({
            'success': True,
            'message': f'{count}개의 북마크가 삭제되었습니다'
        })


class ReflectionNoteViewSet(viewsets.ModelViewSet):
    """묵상노트 CRUD API"""
    serializer_class = ReflectionNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReflectionNote.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'success': True, 'message': '묵상노트가 삭제되었습니다'})

    @action(detail=False, methods=['get'], url_path='by-chapter')
    def by_chapter(self, request):
        """특정 장의 묵상노트 조회"""
        book = request.query_params.get('book')
        chapter = request.query_params.get('chapter')
        if not book or not chapter:
            return Response({
                'success': False,
                'error': 'book and chapter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            chapter = int(chapter)
        except ValueError:
            return Response({
                'success': False,
                'error': 'chapter must be a number'
            }, status=status.HTTP_400_BAD_REQUEST)

        notes = self.get_queryset().filter(book=book, chapter=chapter)
        serializer = self.get_serializer(notes, many=True)
        return Response({'success': True, 'notes': serializer.data})

    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request):
        """모든 묵상노트 삭제"""
        count, _ = self.get_queryset().delete()
        return Response({
            'success': True,
            'message': f'{count}개의 묵상노트가 삭제되었습니다'
        })


class BibleHighlightViewSet(viewsets.ModelViewSet):
    """하이라이트 CRUD API"""
    serializer_class = BibleHighlightSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BibleHighlight.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({'success': True, 'message': '하이라이트가 삭제되었습니다'})

    @action(detail=False, methods=['get'], url_path='by-chapter')
    def by_chapter(self, request):
        """특정 장의 하이라이트 조회"""
        book = request.query_params.get('book')
        chapter = request.query_params.get('chapter')
        if not book or not chapter:
            return Response({
                'success': False,
                'error': 'book and chapter required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            chapter = int(chapter)
        except ValueError:
            return Response({
                'success': False,
                'error': 'chapter must be a number'
            }, status=status.HTTP_400_BAD_REQUEST)

        highlights = self.get_queryset().filter(book=book, chapter=chapter)
        serializer = self.get_serializer(highlights, many=True)
        return Response({'success': True, 'highlights': serializer.data})

    @action(detail=False, methods=['delete'], url_path='delete-all')
    def delete_all(self, request):
        """모든 하이라이트 삭제"""
        count, _ = self.get_queryset().delete()
        return Response({
            'success': True,
            'message': f'{count}개의 하이라이트가 삭제되었습니다'
        })


# 성경책별 총 장 수
BIBLE_CHAPTER_COUNTS = {
    'gen': 50, 'exo': 40, 'lev': 27, 'num': 36, 'deu': 34,
    'jos': 24, 'jdg': 21, 'rut': 4, '1sa': 31, '2sa': 24,
    '1ki': 22, '2ki': 25, '1ch': 29, '2ch': 36, 'ezr': 10,
    'neh': 13, 'est': 10, 'job': 42, 'psa': 150, 'pro': 31,
    'ecc': 12, 'sng': 8, 'isa': 66, 'jer': 52, 'lam': 5,
    'ezk': 48, 'dan': 12, 'hos': 14, 'jol': 3, 'amo': 9,
    'oba': 1, 'jon': 4, 'mic': 7, 'nam': 3, 'hab': 3,
    'zep': 3, 'hag': 2, 'zec': 14, 'mal': 4,
    'mat': 28, 'mrk': 16, 'luk': 24, 'jhn': 21, 'act': 28,
    'rom': 16, '1co': 16, '2co': 13, 'gal': 6, 'eph': 6,
    'php': 4, 'col': 4, '1th': 5, '2th': 3,
    '1ti': 6, '2ti': 4, 'tit': 3, 'phm': 1, 'heb': 13,
    'jas': 5, '1pe': 5, '2pe': 3, '1jn': 5,
    '2jn': 1, '3jn': 1, 'jud': 1, 'rev': 22,
    'jnh': 4,  # 요나서 코드 별칭 ('jon'과 동일)
}


class PersonalReadingRecordViewSet(viewsets.ModelViewSet):
    """개인 읽기 기록 API"""
    serializer_class = PersonalReadingRecordSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post']  # 삭제/수정 불가

    def get_queryset(self):
        return PersonalReadingRecord.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # 중복 체크 - 이미 있으면 업데이트
        book = request.data.get('book')
        chapter = request.data.get('chapter')

        if book and chapter:
            existing = PersonalReadingRecord.objects.filter(
                user=request.user,
                book=book,
                chapter=chapter
            ).first()

            if existing:
                # 이미 읽은 기록이 있으면 날짜만 업데이트
                from datetime import date
                existing.read_date = request.data.get('read_date', date.today())
                existing.save()
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """읽기 통계 조회"""
        records = self.get_queryset()

        # 책별 읽은 장 수 계산
        books_progress = defaultdict(lambda: {'read': 0, 'total': 0})
        for record in records:
            books_progress[record.book]['read'] += 1

        # 각 책의 총 장 수 추가
        for book in books_progress:
            books_progress[book]['total'] = BIBLE_CHAPTER_COUNTS.get(book, 0)

        # 완독한 책 수 계산
        books_completed = sum(
            1 for book, progress in books_progress.items()
            if progress['read'] >= progress['total'] and progress['total'] > 0
        )

        # 연속 읽기 일수 (streak) 계산
        from datetime import date, timedelta
        dates = records.values_list('read_date', flat=True).distinct().order_by('-read_date')
        dates_list = list(dates)

        current_streak = 0
        if dates_list:
            today = date.today()
            expected_date = today

            for read_date in dates_list:
                if read_date == expected_date:
                    current_streak += 1
                    expected_date -= timedelta(days=1)
                elif read_date == expected_date + timedelta(days=1):
                    # 오늘 안 읽었지만 어제 읽었으면 어제부터 카운트
                    current_streak += 1
                    expected_date = read_date - timedelta(days=1)
                else:
                    break

        stats = {
            'total_chapters_read': records.count(),
            'books_read': records.values('book').distinct().count(),
            'books_completed': books_completed,
            'current_streak': current_streak,
            'books_progress': dict(books_progress)
        }

        return Response({'success': True, 'stats': stats})

    @action(detail=False, methods=['get'], url_path='by-book')
    def by_book(self, request):
        """특정 책의 읽기 기록 조회"""
        book = request.query_params.get('book')
        if not book:
            return Response({
                'success': False,
                'error': 'book required'
            }, status=status.HTTP_400_BAD_REQUEST)

        records = self.get_queryset().filter(book=book)
        serializer = self.get_serializer(records, many=True)

        # 읽은 장 목록
        read_chapters = list(records.values_list('chapter', flat=True))
        total_chapters = BIBLE_CHAPTER_COUNTS.get(book, 0)

        return Response({
            'success': True,
            'records': serializer.data,
            'read_chapters': read_chapters,
            'total_chapters': total_chapters,
            'is_completed': len(read_chapters) >= total_chapters if total_chapters > 0 else False
        })

    @action(detail=False, methods=['get'])
    def dates(self, request):
        """읽기 날짜 목록 조회 (캘린더용)"""
        records = self.get_queryset()
        dates = list(
            records.values_list('read_date', flat=True)
            .distinct()
            .order_by('-read_date')
        )
        # YYYY-MM-DD 포맷으로 변환
        date_strings = [d.isoformat() for d in dates if d]
        return Response({'success': True, 'dates': date_strings})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bible_home_stats(request):
    """
    성경 홈 화면용 통합 통계 API
    북마크, 노트, 하이라이트 카운트와 최근 읽은 기록을 효율적으로 반환
    """
    user = request.user
    limit = int(request.query_params.get('recent_limit', 5))

    # 카운트만 조회 (데이터 전체를 가져오지 않음)
    bookmark_count = BibleBookmark.objects.filter(user=user).count()
    note_count = ReflectionNote.objects.filter(user=user).count()
    highlight_count = BibleHighlight.objects.filter(user=user).count()

    # 최근 읽은 기록 (limit 개수만)
    recent_records = PersonalReadingRecord.objects.filter(user=user).order_by('-read_date', '-id')[:limit]
    recent_records_data = [
        {
            'book': r.book,
            'chapter': r.chapter,
            'read_date': r.read_date.isoformat() if r.read_date else None
        }
        for r in recent_records
    ]

    return Response({
        'bookmarks': bookmark_count,
        'notes': note_count,
        'highlights': highlight_count,
        'recent_records': recent_records_data
    }) 
