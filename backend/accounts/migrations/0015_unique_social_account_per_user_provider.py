from django.db import migrations, models


class DuplicateSocialAccountProviderError(RuntimeError):
    pass


def assert_no_duplicate_user_provider_social_accounts(apps, schema_editor):
    SocialAccount = apps.get_model('accounts', 'SocialAccount')
    seen = set()
    duplicate_keys = set()

    queryset = SocialAccount.objects.order_by('user_id', 'provider', '-created_at', '-id')
    for account in queryset.only('id', 'user_id', 'provider', 'created_at'):
        key = (account.user_id, account.provider)
        if key in seen:
            duplicate_keys.add(key)
        else:
            seen.add(key)

    if duplicate_keys:
        formatted_keys = ', '.join(
            f'user_id={user_id}, provider={provider}' for user_id, provider in sorted(duplicate_keys)
        )
        raise DuplicateSocialAccountProviderError(
            'Duplicate SocialAccount rows must be resolved before applying '
            f'unique_social_account_per_user_provider: {formatted_keys}'
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_add_hasena_achievements'),
    ]

    operations = [
        migrations.RunPython(
            assert_no_duplicate_user_provider_social_accounts,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='socialaccount',
            constraint=models.UniqueConstraint(
                fields=('user', 'provider'),
                name='unique_social_account_per_user_provider',
            ),
        ),
    ]
