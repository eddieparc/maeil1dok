from django.db import migrations, models
from django.db.models import Count


def reject_duplicate_active_catchup_sessions(apps, schema_editor):
    CatchupSession = apps.get_model('todos', 'CatchupSession')
    duplicate_count = (
        CatchupSession.objects
        .filter(status='active')
        .values('subscription_id')
        .annotate(cnt=Count('id'))
        .filter(cnt__gt=1)
        .count()
    )
    if duplicate_count:
        raise RuntimeError(
            'Cannot add active catchup session constraint: '
            f'{duplicate_count} subscriptions have duplicate active sessions.'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0028_readinggroup_max_members_range'),
    ]

    operations = [
        migrations.RunPython(
            reject_duplicate_active_catchup_sessions,
            migrations.RunPython.noop,
        ),
        migrations.AddField(
            model_name='catchupsession',
            name='active_subscription_identity',
            field=models.GeneratedField(
                db_persist=True,
                editable=False,
                expression=models.Case(
                    models.When(status='active', then='subscription_id'),
                    default=models.Value(None),
                    output_field=models.IntegerField(null=True),
                ),
                null=True,
                output_field=models.IntegerField(null=True),
                unique=True,
            ),
        ),
    ]
