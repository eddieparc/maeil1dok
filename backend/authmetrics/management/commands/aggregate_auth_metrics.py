"""Fold outbox rows into counters from the command line.

Exists so the pipeline can be drained without a broker -- during QA, and as the
manual recovery path if the worker is down.
"""

from django.core.management.base import BaseCommand

from authmetrics.recording import aggregate_pending


class Command(BaseCommand):
    help = '대기 중인 인증 이벤트를 카운터로 집계한다.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=1000)

    def handle(self, *args, **options):
        folded = aggregate_pending(limit=options['limit'])
        self.stdout.write(f'집계 완료: {folded}건')
