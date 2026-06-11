# UserBibleProgress (subscription, schedule) 중복 진도 레코드를 정리한 뒤
# 유니크 제약을 추가한다. 동시 요청으로 같은 진도가 두 번 생성되는 것을 막는다.

from django.db import migrations, models
from django.db.models import Count


def dedupe_progress(apps, schema_editor):
    UserBibleProgress = apps.get_model('todos', 'UserBibleProgress')

    duplicates = (
        UserBibleProgress.objects
        .values('subscription_id', 'schedule_id')
        .annotate(cnt=Count('id'))
        .filter(cnt__gt=1)
    )

    for dup in duplicates.iterator():
        rows = list(
            UserBibleProgress.objects
            .filter(
                subscription_id=dup['subscription_id'],
                schedule_id=dup['schedule_id'],
            )
            # 완료된 레코드 > 최근 갱신 레코드 순으로 살린다
            .order_by('-is_completed', '-updated_at', '-id')
        )
        for row in rows[1:]:
            row.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0022_hasenasummary_and_more'),
    ]

    operations = [
        migrations.RunPython(dedupe_progress, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='userbibleprogress',
            constraint=models.UniqueConstraint(
                fields=('subscription', 'schedule'),
                name='unique_progress_per_schedule',
            ),
        ),
    ]
