from django.core.management.base import BaseCommand
from django.db.models import Count, Max, F
from django.utils import timezone
from datetime import datetime, timedelta
from accounts.models import User, UserProfile, UserAchievement
from todos.models import UserBibleProgress, PlanSubscription
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '기존 사용자들의 프로필 데이터를 마이그레이션합니다.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('사용자 프로필 마이그레이션을 시작합니다...'))
        
        users = User.objects.all()
        total_users = users.count()
        migrated_count = 0
        
        for user in users:
            try:
                # UserProfile 생성 또는 가져오기
                profile, created = UserProfile.objects.get_or_create(user=user)
                
                if created:
                    self.stdout.write(f'새 프로필 생성: {user.nickname}')
                
                # 총 완료 일수 계산
                completed_days = UserBibleProgress.objects.filter(
                    subscription__user=user,
                    is_completed=True
                ).values('schedule__date').distinct().count()
                
                profile.total_completed_days = completed_days
                
                # 연속 일수 계산 (현재 스트릭)
                current_streak = self.calculate_current_streak(user)
                profile.current_streak = current_streak
                
                # 최장 연속 일수 계산
                longest_streak = self.calculate_longest_streak(user)
                profile.longest_streak = max(longest_streak, current_streak)
                
                profile.save()
                
                # 업적 확인 및 생성
                self.check_and_create_achievements(user, profile)
                
                migrated_count += 1
                
                if migrated_count % 10 == 0:
                    self.stdout.write(f'진행 상황: {migrated_count}/{total_users}')
                    
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'사용자 {user.nickname} 마이그레이션 실패: {str(e)}')
                )
                logger.exception('마이그레이션 오류: user_id=%s', user.id)
        
        self.stdout.write(
            self.style.SUCCESS(f'마이그레이션 완료! {migrated_count}/{total_users} 사용자 처리됨')
        )
    
    def calculate_current_streak(self, user):
        """현재 연속 일수 계산"""
        today = timezone.now().date()
        streak = 0
        current_date = today
        
        while True:
            # 해당 날짜에 완료한 기록이 있는지 확인
            completed = UserBibleProgress.objects.filter(
                subscription__user=user,
                is_completed=True,
                schedule__date=current_date
            ).exists()
            
            if not completed:
                # 오늘이면 어제 확인
                if current_date == today:
                    current_date = today - timedelta(days=1)
                    continue
                else:
                    break
            
            streak += 1
            current_date -= timedelta(days=1)
        
        return streak
    
    def calculate_longest_streak(self, user):
        """최장 연속 일수 계산"""
        # 모든 완료 날짜 가져오기
        completed_dates = UserBibleProgress.objects.filter(
            subscription__user=user,
            is_completed=True
        ).values_list('schedule__date', flat=True).distinct().order_by('schedule__date')
        
        if not completed_dates:
            return 0
        
        max_streak = 1
        current_streak = 1
        prev_date = None
        
        for date in completed_dates:
            if prev_date:
                diff = (date - prev_date).days
                if diff == 1:
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    current_streak = 1
            prev_date = date
        
        return max_streak
    
    def check_and_create_achievements(self, user, profile):
        """업적 확인 및 생성"""
        # 첫 완독 업적
        if profile.total_completed_days >= 1:
            UserAchievement.objects.get_or_create(
                user=user,
                achievement_type='first_complete',
                defaults={'milestone_value': 1}
            )
        
        # 연속 일수 업적
        streak_milestones = [
            (7, 'streak_7'),
            (30, 'streak_30'),
            (100, 'streak_100')
        ]
        
        for days, achievement_type in streak_milestones:
            if profile.longest_streak >= days:
                UserAchievement.objects.get_or_create(
                    user=user,
                    achievement_type=achievement_type,
                    defaults={'milestone_value': days}
                )
        
        # 누적 일수 업적
        total_milestones = [
            (30, 'total_30'),
            (100, 'total_100'),
            (365, 'total_365')
        ]
        
        for days, achievement_type in total_milestones:
            if profile.total_completed_days >= days:
                UserAchievement.objects.get_or_create(
                    user=user,
                    achievement_type=achievement_type,
                    defaults={'milestone_value': days}
                )
        
        self.stdout.write(f'  - {user.nickname}: {UserAchievement.objects.filter(user=user).count()}개 업적 달성')
