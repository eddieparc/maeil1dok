"""Apply the retention floor. Pinned rows are kept regardless of age."""

from django.core.management.base import BaseCommand

from authmetrics.recording import purge_expired


class Command(BaseCommand):
    help = '보존 기간이 지난 지표 행을 삭제한다(고정된 행은 남긴다).'

    def handle(self, *args, **options):
        deleted = purge_expired()
        self.stdout.write(f'삭제: {deleted}행')
