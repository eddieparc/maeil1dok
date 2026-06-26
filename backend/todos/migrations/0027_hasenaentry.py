from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0026_notificationpushsubscription'),
    ]

    operations = [
        migrations.CreateModel(
            name='HasenaEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True, help_text='하세나 기준 날짜', unique=True)),
                ('video_id', models.CharField(db_index=True, max_length=20)),
                ('title', models.CharField(blank=True, max_length=200)),
                ('passage', models.CharField(blank=True, help_text='본문 범위', max_length=120)),
                ('body_text', models.TextField(blank=True, help_text='파싱된 본문 텍스트')),
                ('verses', models.JSONField(blank=True, default=list, help_text='절 단위 본문')),
                ('source_url', models.URLField(blank=True)),
                ('body_source_url', models.URLField(blank=True)),
                ('fetched_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': '하세나 본문 캐시',
                'verbose_name_plural': '하세나 본문 캐시',
                'ordering': ['-date'],
            },
        ),
    ]
