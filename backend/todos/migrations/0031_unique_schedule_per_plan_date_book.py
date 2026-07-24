from django.db import migrations, models
from django.db.models import Count


def reject_duplicate_schedules(apps, schema_editor):
    DailyBibleSchedule = apps.get_model('todos', 'DailyBibleSchedule')
    duplicates = (
        DailyBibleSchedule.objects.values('plan_id', 'date', 'book')
        .annotate(count=Count('id'))
        .filter(count__gt=1)
    )
    if duplicates.exists():
        raise RuntimeError(
            'Cannot add unique_schedule_per_plan_date_book: duplicate schedules exist.'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0030_alter_readinggroup_max_members'),
    ]

    operations = [
        migrations.RunPython(reject_duplicate_schedules, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='dailybibleschedule',
            constraint=models.UniqueConstraint(
                fields=('plan', 'date', 'book'),
                name='unique_schedule_per_plan_date_book',
            ),
        ),
    ]
