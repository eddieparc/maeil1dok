from django.db import migrations, models
from django.db.models import Q


def clamp_invalid_max_members(apps, schema_editor):
    """Repair existing rows with invalid max_members before adding constraint."""
    ReadingGroup = apps.get_model('todos', 'ReadingGroup')
    
    # Clamp negative or zero values to default of 50
    updated = ReadingGroup.objects.filter(
        Q(max_members__lte=0) | Q(max_members__gt=10000)
    ).update(max_members=50)
    
    if updated:
        print(f"Clamped {updated} ReadingGroup rows with invalid max_members to 50")


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0027_hasenaentry'),
    ]

    operations = [
        # First, repair existing data
        migrations.RunPython(
            clamp_invalid_max_members,
            reverse_code=migrations.RunPython.noop,
        ),
        # Then add the constraint
        migrations.AddConstraint(
            model_name='readinggroup',
            constraint=models.CheckConstraint(
                check=models.Q(max_members__gte=1, max_members__lte=10000),
                name='readinggroup_max_members_range',
            ),
        ),
    ]
