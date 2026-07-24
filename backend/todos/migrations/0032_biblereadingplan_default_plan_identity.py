from django.db import migrations, models


def dedupe_default_plans(apps, schema_editor):
    """Keep only the lowest-id plan with is_default=True; clear the rest.

    Mirrors the deterministic `.filter(is_default=True).first()` selection
    semantics existing consumers rely on, so environments that already
    violate the single-default invariant converge to the same choice.
    """
    BibleReadingPlan = apps.get_model('todos', 'BibleReadingPlan')
    default_ids = list(
        BibleReadingPlan.objects
        .filter(is_default=True)
        .order_by('id')
        .values_list('id', flat=True)
    )
    if len(default_ids) > 1:
        BibleReadingPlan.objects.filter(id__in=default_ids[1:]).update(is_default=False)


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0031_unique_schedule_per_plan_date_book'),
    ]

    operations = [
        migrations.RunPython(dedupe_default_plans, migrations.RunPython.noop),
        migrations.AddField(
            model_name='biblereadingplan',
            name='default_plan_identity',
            field=models.GeneratedField(
                db_persist=True,
                editable=False,
                expression=models.Case(
                    models.When(is_default=True, then=models.Value(1)),
                    default=models.Value(None),
                    output_field=models.IntegerField(null=True),
                ),
                null=True,
                output_field=models.IntegerField(null=True),
                unique=True,
            ),
        ),
    ]
