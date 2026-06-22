from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0025_notification_notificationsettings'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='NotificationPushSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('endpoint', models.URLField(max_length=500, unique=True)),
                ('p256dh', models.CharField(max_length=255)),
                ('auth', models.CharField(max_length=255)),
                ('user_agent', models.CharField(blank=True, max_length=255)),
                ('enabled', models.BooleanField(default=True)),
                ('failure_count', models.PositiveSmallIntegerField(default=0)),
                ('last_success_at', models.DateTimeField(blank=True, null=True)),
                ('last_failure_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notification_push_subscriptions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': '푸시 알림 구독',
                'verbose_name_plural': '푸시 알림 구독',
                'indexes': [
                    models.Index(fields=['user', 'enabled'], name='todos_notif_user_id_d1bc47_idx'),
                    models.Index(fields=['endpoint'], name='todos_notif_endpoin_8f7e0b_idx'),
                ],
            },
        ),
    ]
