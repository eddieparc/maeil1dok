from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_unique_social_account_per_user_provider'),
    ]

    operations = [
        migrations.AddField(
            model_name='userreadingsettings',
            name='daily_reading_reminder',
            field=models.BooleanField(default=True, help_text='매일 읽기 알림'),
        ),
        migrations.AddField(
            model_name='userreadingsettings',
            name='weekly_progress_summary',
            field=models.BooleanField(default=False, help_text='주간 진행 요약 알림'),
        ),
        migrations.AddField(
            model_name='userreadingsettings',
            name='service_notice',
            field=models.BooleanField(default=True, help_text='서비스 공지 알림'),
        ),
        migrations.AddField(
            model_name='userreadingsettings',
            name='reminder_time',
            field=models.TimeField(default='07:00', help_text='읽기 알림 시간'),
        ),
    ]
