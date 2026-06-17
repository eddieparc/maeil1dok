from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_alter_socialaccount_provider"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userachievement",
            name="achievement_type",
            field=models.CharField(
                choices=[
                    ("first_complete", "첫 완독"),
                    ("streak_7", "7일 연속"),
                    ("streak_30", "30일 연속"),
                    ("streak_100", "100일 연속"),
                    ("total_30", "누적 30일"),
                    ("total_100", "누적 100일"),
                    ("total_365", "누적 365일"),
                    ("book_complete", "책 완독"),
                    ("testament_complete", "구약/신약 완독"),
                    ("bible_complete", "성경 완독"),
                    ("hasena_total_30", "하세나하시조 30일"),
                    ("hasena_total_100", "하세나하시조 100일"),
                    ("hasena_streak_7", "하세나하시조 7회 연속"),
                ],
                max_length=50,
            ),
        ),
    ]
