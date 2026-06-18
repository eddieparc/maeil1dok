from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0023_unique_progress_per_schedule'),
    ]

    operations = [
        migrations.AlterField(
            model_name='hasenasummary',
            name='model_used',
            field=models.CharField(default='gemini-3.5-flash', max_length=50),
        ),
    ]
