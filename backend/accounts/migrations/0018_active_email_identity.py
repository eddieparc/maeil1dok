from collections import Counter

from django.db import migrations, models
from django.db.models import Case, Value, When
from django.db.models.functions import Lower, NullIf, Trim


def reject_duplicate_active_email_identities(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    normalized_emails = (
        (user.email or '').strip().lower()
        for user in User.objects.filter(is_active=True)
        .exclude(email__isnull=True)
        .only('email')
        .iterator()
    )
    counts = Counter(email for email in normalized_emails if email)
    duplicate_count = sum(1 for count in counts.values() if count > 1)
    if duplicate_count:
        raise RuntimeError(
            'Cannot add active email identity constraint: '
            f'{duplicate_count} duplicate active email identities require remediation.'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_userreadingsettings_range_constraints'),
    ]

    operations = [
        migrations.RunPython(
            reject_duplicate_active_email_identities,
            migrations.RunPython.noop,
        ),
        migrations.AddField(
            model_name='user',
            name='active_email_identity',
            field=models.GeneratedField(
                db_persist=True,
                editable=False,
                expression=Case(
                    When(
                        is_active=True,
                        email__isnull=False,
                        then=NullIf(Lower(Trim('email')), Value('')),
                    ),
                    default=Value(None),
                    output_field=models.CharField(max_length=254, null=True),
                ),
                null=True,
                output_field=models.CharField(max_length=254, null=True),
                unique=True,
            ),
        ),
    ]
