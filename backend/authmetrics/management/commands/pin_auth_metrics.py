"""Pin or unpin a date range so retention cannot delete it.

F5 compares a pre-deploy week against the following two weeks, which outlives
the retention floor. Pinning is how that evidence survives without copying it
into a second table that could drift from the source.
"""

from datetime import date

from django.core.management.base import BaseCommand, CommandError

from authmetrics.models import AuthMetricCounter


class Command(BaseCommand):
    help = '지정 기간의 지표 행을 보존 대상으로 고정하거나 해제한다.'

    def add_arguments(self, parser):
        parser.add_argument('--from', dest='start', required=True, help='YYYY-MM-DD')
        parser.add_argument('--to', dest='end', required=True, help='YYYY-MM-DD')
        parser.add_argument('--unpin', action='store_true')

    def handle(self, *args, **options):
        try:
            start = date.fromisoformat(options['start'])
            end = date.fromisoformat(options['end'])
        except ValueError as exc:
            raise CommandError(f'날짜 형식이 잘못됐다: {exc}') from exc
        if end < start:
            raise CommandError('--to 가 --from 보다 앞선다.')

        pinned = not options['unpin']
        updated = AuthMetricCounter.objects.filter(
            day__gte=start, day__lte=end
        ).update(pinned=pinned)
        state = '고정' if pinned else '해제'
        self.stdout.write(f'{start}~{end} {updated}행 {state}')
