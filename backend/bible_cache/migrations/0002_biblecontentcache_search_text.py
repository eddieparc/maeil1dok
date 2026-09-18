"""
search_text 컬럼 추가 + 기존 행 백필

검색이 원본 HTML/JSON 대신 정규화된 평문을 대상으로 하도록 한다.
백필은 text_utils.search_text_for_content 와 동일 규칙을 적용한다.
"""

from django.db import migrations, models


def backfill_search_text(apps, schema_editor):
    from bible_cache.text_utils import search_text_for_content

    BibleContentCache = apps.get_model('bible_cache', 'BibleContentCache')
    batch = []
    for row in BibleContentCache.objects.all().iterator(chunk_size=500):
        row.search_text = search_text_for_content(row.content)
        batch.append(row)
        if len(batch) >= 500:
            BibleContentCache.objects.bulk_update(batch, ['search_text'])
            batch = []
    if batch:
        BibleContentCache.objects.bulk_update(batch, ['search_text'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bible_cache', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='biblecontentcache',
            name='search_text',
            field=models.TextField(
                blank=True,
                default='',
                help_text='검색용 정규화 평문 (태그·결합문자·공백 정규화 적용)',
            ),
        ),
        migrations.RunPython(backfill_search_text, noop_reverse),
    ]
