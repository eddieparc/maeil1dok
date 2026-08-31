"""
30일이 지난 삭제 예정 사용자 계정을 완전히 삭제하는 관리 명령

사용법:
    python manage.py cleanup_deleted_users          # 실제 삭제 실행
    python manage.py cleanup_deleted_users --dry-run  # 삭제될 계정만 확인
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = '30일이 지난 삭제 예정 사용자 계정을 완전히 삭제합니다.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='실제 삭제 없이 삭제될 계정만 확인합니다.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        now = timezone.now()
        
        # 삭제 예정 시간이 지난 계정 조회
        users_to_delete = User.objects.filter(
            scheduled_deletion_at__isnull=False,
            scheduled_deletion_at__lte=now,
            is_active=False
        )
        
        count = users_to_delete.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('삭제할 계정이 없습니다.'))
            return
        
        self.stdout.write(f'삭제 대상 계정: {count}개')
        
        for user in users_to_delete:
            merged_into_info = f' -> {user.merged_into.nickname}' if user.merged_into else ''
            self.stdout.write(
                f'  - ID: {user.id}, '
                f'Username: {user.username}, '
                f'삭제예정: {user.scheduled_deletion_at}'
                f'{merged_into_info}'
            )
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY-RUN] 실제 삭제는 수행되지 않았습니다.'))
            return
        
        # 실제 삭제 수행
        deleted_count = 0
        for user in users_to_delete:
            try:
                user_id = user.id
                username = user.username
                user.delete()
                deleted_count += 1
                logger.info('삭제 완료: user_id=%s', user_id)
            except Exception as e:
                logger.exception('삭제 실패: user_id=%s', user.id)
                self.stdout.write(
                    self.style.ERROR(f'삭제 실패: ID {user.id} - {str(e)}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'\n총 {deleted_count}개 계정이 삭제되었습니다.')
        )
