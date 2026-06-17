"""
업적 서비스 모듈
- 사용자 업적 조건 확인 및 자동 부여
- 프로필 통계 업데이트 (total_completed_days, current_streak, longest_streak)
"""

from datetime import timedelta
from django.utils import timezone
from django.db.models import Count

from accounts.models import UserAchievement, UserProfile
from accounts.achievement_config import BIBLE_BOOKS, ALL_BIBLE_BOOKS
from todos.models import UserBibleProgress, DailyBibleSchedule
from todos.services.hasena_activity import calculate_hasena_activity_stats


class AchievementService:
    """업적 부여 서비스"""

    @staticmethod
    def check_and_grant_achievements(user):
        """사용자의 모든 업적 조건 확인 및 부여"""
        profile, _ = UserProfile.objects.get_or_create(user=user)
        granted = []

        if profile.total_completed_days >= 1:
            if AchievementService._grant_achievement(user, 'first_complete', 1):
                granted.append('first_complete')

        streak_milestones = [(7, 'streak_7'), (30, 'streak_30'), (100, 'streak_100')]
        for days, achievement_type in streak_milestones:
            if profile.longest_streak >= days:
                if AchievementService._grant_achievement(user, achievement_type, days):
                    granted.append(achievement_type)

        total_milestones = [(30, 'total_30'), (100, 'total_100'), (365, 'total_365')]
        for days, achievement_type in total_milestones:
            if profile.total_completed_days >= days:
                if AchievementService._grant_achievement(user, achievement_type, days):
                    granted.append(achievement_type)

        hasena_stats = calculate_hasena_activity_stats(user)
        hasena_total_milestones = [(30, 'hasena_total_30'), (100, 'hasena_total_100')]
        for days, achievement_type in hasena_total_milestones:
            if hasena_stats['total_completed'] >= days:
                if AchievementService._grant_achievement(user, achievement_type, days):
                    granted.append(achievement_type)

        if hasena_stats['longest_streak'] >= 7:
            if AchievementService._grant_achievement(user, 'hasena_streak_7', 7):
                granted.append('hasena_streak_7')

        book_completed = AchievementService._check_book_completion(user)
        if book_completed:
            if AchievementService._grant_achievement(user, 'book_complete', len(book_completed),
                                                      details={'books': book_completed}):
                granted.append('book_complete')

        testament_completed = AchievementService._check_testament_completion(user)
        if testament_completed:
            if AchievementService._grant_achievement(user, 'testament_complete', len(testament_completed),
                                                      details={'testaments': testament_completed}):
                granted.append('testament_complete')

        if AchievementService._check_bible_completion(user):
            if AchievementService._grant_achievement(user, 'bible_complete', 66):
                granted.append('bible_complete')

        return granted

    @staticmethod
    def _grant_achievement(user, achievement_type, milestone_value, details=None):
        """업적 부여 (중복 방지)"""
        defaults = {'milestone_value': milestone_value}
        if details:
            defaults['details'] = details

        _, created = UserAchievement.objects.get_or_create(
            user=user,
            achievement_type=achievement_type,
            defaults=defaults
        )
        return created

    @staticmethod
    def update_user_stats(user):
        """프로필 통계 업데이트"""
        profile, _ = UserProfile.objects.get_or_create(user=user)

        # 총 완료 일수 계산 (고유한 날짜 수)
        profile.total_completed_days = UserBibleProgress.objects.filter(
            subscription__user=user,
            is_completed=True
        ).values('schedule__date').distinct().count()

        # 연속 일수 계산
        profile.current_streak = AchievementService._calculate_current_streak(user)
        longest = AchievementService._calculate_longest_streak(user)
        profile.longest_streak = max(profile.longest_streak, longest)

        profile.save()
        return profile

    @staticmethod
    def _calculate_current_streak(user):
        """현재 연속 일수 계산"""
        today = timezone.now().date()
        streak = 0
        current_date = today

        # 최대 366일까지만 확인 (1년 + 1일)
        max_days = 366
        checked = 0

        while checked < max_days:
            completed = UserBibleProgress.objects.filter(
                subscription__user=user,
                is_completed=True,
                schedule__date=current_date
            ).exists()

            if not completed:
                # 오늘이면 어제부터 확인
                if current_date == today:
                    current_date -= timedelta(days=1)
                    checked += 1
                    continue
                break

            streak += 1
            current_date -= timedelta(days=1)
            checked += 1

        return streak

    @staticmethod
    def _calculate_longest_streak(user):
        """최장 연속 일수 계산"""
        completed_dates = list(UserBibleProgress.objects.filter(
            subscription__user=user,
            is_completed=True
        ).values_list('schedule__date', flat=True).distinct().order_by('schedule__date'))

        if not completed_dates:
            return 0

        max_streak = current_streak = 1
        for i in range(1, len(completed_dates)):
            if (completed_dates[i] - completed_dates[i-1]).days == 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 1

        return max_streak

    @staticmethod
    def _check_book_completion(user):
        """성경책별 완독 확인 - 완독한 책 목록 반환"""
        from todos.models import PlanSubscription

        # 사용자가 완료한 모든 스케줄의 책 목록
        completed_books = UserBibleProgress.objects.filter(
            subscription__user=user,
            is_completed=True
        ).values_list('schedule__book', flat=True).distinct()

        completed_books_set = set(completed_books)

        # 사용자의 활성 구독 플랜 ID 목록 가져오기
        active_plan_ids = PlanSubscription.objects.filter(
            user=user,
            is_active=True
        ).values_list('plan_id', flat=True)

        # 각 책에 대해 모든 장을 읽었는지 확인하기 어려우므로,
        # 플랜의 해당 책 스케줄을 모두 완료했는지 확인
        completed_full_books = []

        for book in ALL_BIBLE_BOOKS:
            if book in completed_books_set:
                # 해당 책의 스케줄 중 완료한 것의 비율 확인
                total_schedules = DailyBibleSchedule.objects.filter(
                    book=book,
                    plan_id__in=active_plan_ids
                ).distinct().count()

                if total_schedules > 0:
                    completed_schedules = UserBibleProgress.objects.filter(
                        subscription__user=user,
                        subscription__is_active=True,
                        is_completed=True,
                        schedule__book=book
                    ).distinct().count()

                    # 해당 책의 모든 스케줄을 완료했으면 완독으로 인정
                    if completed_schedules >= total_schedules:
                        completed_full_books.append(book)

        return completed_full_books

    @staticmethod
    def _check_testament_completion(user):
        """구약/신약 완독 확인"""
        completed_books = AchievementService._check_book_completion(user)
        completed_books_set = set(completed_books)

        result = []

        # 구약 완독 확인
        old_testament_set = set(BIBLE_BOOKS['old_testament'])
        if old_testament_set.issubset(completed_books_set):
            result.append('old_testament')

        # 신약 완독 확인
        new_testament_set = set(BIBLE_BOOKS['new_testament'])
        if new_testament_set.issubset(completed_books_set):
            result.append('new_testament')

        return result

    @staticmethod
    def _check_bible_completion(user):
        """성경 전체 완독 확인"""
        completed_books = AchievementService._check_book_completion(user)
        all_books_set = set(ALL_BIBLE_BOOKS)
        completed_books_set = set(completed_books)

        return all_books_set.issubset(completed_books_set)
