import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Iterable

import requests
from django.utils import timezone

from ..models import HasenaEntry
from .hasena_summary_service import get_hasena_video_date, get_recent_hasena_videos

logger = logging.getLogger(__name__)

HASENA_BODY_URL = 'https://xn--910b782abhbh7k53rca.kr/bbs/write.php'
USER_AGENT = 'Maeil1Dok/1.0 (+https://maeil1dok.app)'


@dataclass(frozen=True)
class ParsedHasenaBody:
    passage: str
    body_text: str
    verses: list[dict[str, str]]


def sync_hasena_entries(max_entries: int = 40) -> dict:
    videos = get_recent_hasena_videos(max_results=max_entries)
    synced = []
    skipped = []

    for video in videos:
        video_date = get_hasena_video_date(video)
        video_id = video.get('video_id')
        if not video_date or not video_id:
            skipped.append(video.get('title') or video_id or 'unknown')
            continue

        entry = sync_hasena_entry_for_video(video, video_date)
        if entry:
            synced.append(entry.date.isoformat())
        else:
            skipped.append(video_date.isoformat())

    return {'success': True, 'synced': synced, 'skipped': skipped}


def ensure_hasena_entry(target_date: date) -> HasenaEntry | None:
    cached = HasenaEntry.objects.filter(date=target_date).first()
    if cached:
        return cached

    videos = get_recent_hasena_videos(max_results=40)
    for video in videos:
        if get_hasena_video_date(video) == target_date:
            return sync_hasena_entry_for_video(video, target_date)

    return HasenaEntry.objects.filter(date__lte=target_date).order_by('-date').first()


def sync_hasena_entry_for_video(video: dict, video_date: date) -> HasenaEntry | None:
    video_id = video.get('video_id')
    if not video_id:
        return None

    body_url = build_hasena_body_url(video_date)
    try:
        response = requests.get(body_url, headers={'User-Agent': USER_AGENT}, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Failed to fetch Hasena body for %s: %s", video_date, exc)
        return None

    parsed = parse_hasena_body(response.text)
    if not parsed.passage or not parsed.verses:
        logger.warning("Hasena body missing passage or verses for %s", video_date)
        return None

    entry, _created = HasenaEntry.objects.update_or_create(
        date=video_date,
        defaults={
            'video_id': video_id,
            'title': video.get('title') or '',
            'passage': parsed.passage,
            'body_text': parsed.body_text,
            'verses': parsed.verses,
            'source_url': f'https://www.youtube.com/watch?v={video_id}',
            'body_source_url': body_url,
            'fetched_at': timezone.now(),
        },
    )
    return entry


def build_hasena_body_url(target_date: date) -> str:
    return f'{HASENA_BODY_URL}?bo_table=hasena_record&targetDate={target_date.isoformat()}&forceView=true'


def parse_hasena_body(html: str) -> ParsedHasenaBody:
    passage = strip_html(read_class_text(html, 'bible_tit')).strip()
    verses = []
    for paragraph in extract_tag_blocks(read_class_block(html, 'bible_contents'), 'p'):
        number = strip_html(read_class_text(paragraph, 'bullet_number')).strip()
        text = strip_html(read_class_text(paragraph, 'bullet_txt')).strip()
        if number and text:
            verses.append({'number': number, 'text': text})

    return ParsedHasenaBody(
        passage=passage,
        body_text='\n'.join(f"{verse['number']} {verse['text']}" for verse in verses),
        verses=verses,
    )


def merge_calendar_entries(entries: Iterable[HasenaEntry], completions: Iterable[dict]) -> list[dict]:
    rows_by_date = {
        entry.date.isoformat(): serialize_hasena_entry_summary(entry)
        for entry in entries
    }
    completed_dates = {
        completion['date'].isoformat() if hasattr(completion['date'], 'isoformat') else str(completion['date'])
        for completion in completions
        if completion.get('is_completed')
    }

    for completed_date in completed_dates:
        rows_by_date.setdefault(completed_date, {
            'date': completed_date,
            'passage': '',
            'video_id': '',
            'title': '',
            'is_completed': True,
        })

    for row in rows_by_date.values():
        row['is_completed'] = row['date'] in completed_dates

    return sorted(rows_by_date.values(), key=lambda row: row['date'])


def serialize_hasena_entry(entry: HasenaEntry) -> dict:
    data = serialize_hasena_entry_summary(entry)
    data.update({
        'id': entry.id,
        'body_text': entry.body_text,
        'verses': entry.verses if isinstance(entry.verses, list) else [],
        'source_url': entry.source_url,
        'body_source_url': entry.body_source_url,
        'fetched_at': entry.fetched_at.isoformat() if entry.fetched_at else None,
    })
    return data


def serialize_hasena_entry_summary(entry: HasenaEntry) -> dict:
    return {
        'date': entry.date.isoformat(),
        'passage': entry.passage,
        'video_id': entry.video_id,
        'title': entry.title,
    }


def read_class_block(source: str, class_name: str) -> str:
    pattern = re.compile(
        rf'<([a-z0-9]+)[^>]*class=["\'][^"\']*{re.escape(class_name)}[^"\']*["\'][^>]*>[\s\S]*?</\1>',
        re.IGNORECASE,
    )
    match = pattern.search(source)
    return match.group(0) if match else ''


def read_class_text(source: str, class_name: str) -> str:
    block = read_class_block(source, class_name)
    return re.sub(r'^<[^>]+>|</[a-z0-9]+>$', '', block, flags=re.IGNORECASE)


def extract_tag_blocks(source: str, tag_name: str) -> list[str]:
    pattern = re.compile(rf'<{re.escape(tag_name)}[^>]*>[\s\S]*?</{re.escape(tag_name)}>', re.IGNORECASE)
    return [match.group(0) for match in pattern.finditer(source)]


def strip_html(value: str) -> str:
    return decode_html_entities(re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', value)))


def decode_html_entities(value: str) -> str:
    import html

    return html.unescape(value).strip()
