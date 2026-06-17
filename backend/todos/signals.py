from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import HasenaRecord, PlanSubscription, UserPlanDisplaySettings, UserBibleProgress
from .constants import PLAN_COLORS
from accounts.services.achievement_service import AchievementService


@receiver(post_save, sender=PlanSubscription)
def create_display_settings(sender, instance, created, **kwargs):
    """구독 생성 시 자동으로 표시 설정 생성"""
    if created:
        # 기존 설정 개수로 색상 및 순서 결정
        existing_count = UserPlanDisplaySettings.objects.filter(
            user=instance.user
        ).count()

        UserPlanDisplaySettings.objects.create(
            user=instance.user,
            subscription=instance,
            color=PLAN_COLORS[existing_count % len(PLAN_COLORS)],
            display_order=existing_count
        )


@receiver(post_save, sender=UserBibleProgress)
def update_stats_and_achievements(sender, instance, **kwargs):
    """
    성경 읽기 완료 시 프로필 통계 및 업적 업데이트
    """
    if instance.is_completed:
        user = instance.subscription.user

        # 프로필 통계 업데이트
        AchievementService.update_user_stats(user)

        # 업적 확인 및 부여
        AchievementService.check_and_grant_achievements(user)


@receiver(post_save, sender=HasenaRecord)
def update_hasena_achievements(sender, instance, **kwargs):
    if instance.is_completed:
        AchievementService.check_and_grant_achievements(instance.user)
