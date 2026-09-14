import logging
import requests
import time
import re
import json
import xml.etree.ElementTree as ET
import unicodedata
from datetime import date, datetime, timezone
from typing import Final
from zoneinfo import ZoneInfo
from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

# 하세나하시조 플레이리스트 ID
HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'
GEMINI_SUMMARY_MODELS = ('gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite')
HASENA_SERVICE_TIME_ZONE: Final = ZoneInfo('Asia/Seoul')
HASENA_TITLE_DATE_PATTERN: Final = re.compile(
    r'(?P<year>20\d{2})\D+(?P<month>\d{1,2})\D+(?P<day>\d{1,2})'
)


def _redact_api_keys(message: str) -> str:
    return re.sub(r'([?&]key=)[^&\s]+', r'\1[REDACTED]', message)


def get_recent_hasena_videos(max_results: int = 10) -> list[dict]:
    feed_videos = _get_recent_hasena_videos_from_feed(max_results)
    if feed_videos:
        return feed_videos

    playlist_page_videos = _get_recent_hasena_videos_from_playlist_page(max_results)
    if playlist_page_videos:
        return playlist_page_videos

    return _get_recent_hasena_videos_from_api(max_results)


def _get_recent_hasena_videos_from_feed(max_results: int = 10) -> list[dict]:
    try:
        response = requests.get(
            'https://www.youtube.com/feeds/videos.xml',
            params={'playlist_id': HASENA_PLAYLIST_ID},
            timeout=10,
        )
        response.raise_for_status()

        namespaces = {
            'atom': 'http://www.w3.org/2005/Atom',
            'yt': 'http://www.youtube.com/xml/schemas/2015',
        }
        root = ET.fromstring(response.content)
        videos = []
        for entry in root.findall('atom:entry', namespaces):
            video_id = entry.findtext('yt:videoId', namespaces=namespaces)
            title = entry.findtext('atom:title', default='', namespaces=namespaces)

            if not video_id or title.lower() == 'private video':
                continue

            videos.append({
                'video_id': video_id,
                'title': title,
                'published_at': entry.findtext('atom:published', namespaces=namespaces),
            })

            if len(videos) >= max_results:
                break

        if not videos:
            logger.warning("No public videos found in playlist feed")
        return videos
    except requests.exceptions.RequestException as e:
        logger.warning("Error fetching playlist feed", exc_info=True)
        return []
    except ET.ParseError as e:
        logger.warning("Error parsing playlist feed", exc_info=True)
        return []


def _get_recent_hasena_videos_from_playlist_page(max_results: int = 10) -> list[dict]:
    try:
        response = requests.get(
            'https://www.youtube.com/playlist',
            params={'list': HASENA_PLAYLIST_ID},
            headers={
                'User-Agent': 'Mozilla/5.0 (compatible; Maeil1Dok/1.0; +https://maeil1dok.app)',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            timeout=10,
        )
        response.raise_for_status()

        videos = []
        seen_video_ids = set()
        for match in re.finditer(r'"videoId":"(?P<video_id>[A-Za-z0-9_-]{11})"', response.text):
            video_id = match.group('video_id')
            if video_id in seen_video_ids:
                continue

            seen_video_ids.add(video_id)
            videos.append({
                'video_id': video_id,
                'title': _extract_playlist_page_title(response.text, match.start()) or '',
                'published_at': None,
            })

            if len(videos) >= max_results:
                break

        if not videos:
            logger.warning("No public videos found in playlist page")
        return videos
    except requests.exceptions.RequestException as e:
        logger.warning("Error fetching playlist page", exc_info=True)
        return []


def _extract_playlist_page_title(html: str, video_id_position: int) -> str | None:
    search_window = html[video_id_position:video_id_position + 3000]
    title_match = re.search(
        r'"title":\{"runs":\[\{"text":"(?P<title>(?:\\.|[^"\\])*)"',
        search_window,
    )
    if not title_match:
        return None

    try:
        return json.loads(f'"{title_match.group("title")}"')
    except json.JSONDecodeError:
        return title_match.group('title')


def _get_recent_hasena_videos_from_api(max_results: int = 10) -> list[dict]:
    api_key = getattr(settings, 'YOUTUBE_API_KEY', None)
    if not api_key:
        logger.error("No YouTube API key configured")
        return []

    gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if gemini_api_key and api_key == gemini_api_key:
        logger.error("YOUTUBE_API_KEY matches GEMINI_API_KEY; skipping YouTube Data API call")
        return []
    
    try:
        url = 'https://www.googleapis.com/youtube/v3/playlistItems'
        params = {
            'part': 'snippet,status,contentDetails',
            'playlistId': HASENA_PLAYLIST_ID,
            'maxResults': max_results,
            'key': api_key
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('items'):
            logger.warning("No videos found in playlist")
            return []
        
        videos = []
        for item in data['items']:
            snippet = item.get('snippet', {})
            content_details = item.get('contentDetails', {})
            status = item.get('status', {})
            video_id = snippet.get('resourceId', {}).get('videoId')
            title = snippet.get('title') or ''
            privacy_status = status.get('privacyStatus')

            if not video_id or title.lower() == 'private video' or privacy_status == 'private':
                continue

            videos.append({
                'video_id': video_id,
                'title': title,
                'published_at': content_details.get('videoPublishedAt') or snippet.get('publishedAt'),
            })
        
        if not videos:
            logger.warning("No public videos found in playlist")
        return videos
        
    except requests.exceptions.RequestException as e:
        logger.exception("Error fetching playlist")
        return []
    except Exception as e:
        logger.exception("Unexpected error fetching playlist")
        return []


def get_hasena_video_date(video_info: dict) -> date | None:
    published_at_date = _parse_hasena_published_at_date(video_info.get('published_at'))
    if published_at_date:
        return published_at_date

    return _parse_hasena_title_date(video_info.get('title') or '')


def get_hasena_video_for_date(target_date: date, candidates: list[dict] | None = None) -> dict | None:
    videos = candidates if candidates is not None else get_recent_hasena_videos()
    for video_info in videos:
        if not video_info.get('video_id'):
            continue

        if get_hasena_video_date(video_info) == target_date:
            return video_info

    return None


def _parse_hasena_title_date(title: str) -> date | None:
    if not title:
        return None

    normalized_title = unicodedata.normalize('NFC', title)
    match = HASENA_TITLE_DATE_PATTERN.search(normalized_title)
    if not match:
        return None

    try:
        return date(
            int(match.group('year')),
            int(match.group('month')),
            int(match.group('day')),
        )
    except ValueError:
        logger.warning("Invalid Hasena title date: %s", title)
        return None


def _parse_hasena_published_at_date(value: str | None) -> date | None:
    if not value:
        return None

    try:
        published_at = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        logger.warning("Invalid Hasena published_at value: %s", value)
        return None

    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    return published_at.astimezone(HASENA_SERVICE_TIME_ZONE).date()


def get_youtube_transcript(video_id: str, languages: list = None) -> str | None:
    if languages is None:
        languages = ['ko', 'en']
    
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            TranscriptsDisabled,
            NoTranscriptFound,
            VideoUnavailable,
        )
        
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id, languages=languages)
        full_text = ' '.join([snippet.text for snippet in transcript])
        return full_text
        
    except TranscriptsDisabled:
        logger.warning(f"Transcripts disabled for video: {video_id}")
        return None
    except NoTranscriptFound:
        logger.warning(f"No transcript found for video: {video_id}")
        return None
    except VideoUnavailable:
        logger.warning(f"Video unavailable: {video_id}")
        return None
    except Exception as e:
        logger.error("Error fetching transcript: video_id=%s", video_id)
        return None


def summarize_with_gemini(transcript: str) -> dict | None:
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if not api_key:
        logger.error("GEMINI_API_KEY not configured")
        return None
    
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        prompt = f"""다음은 하세나하시조 영상의 자막입니다. 아래 형식에 맞춰 요약해주세요.

## 출력 형식 (반드시 준수)

**오늘의 본문**
[성경 구절 (예: 마태복음 27장 1-10절)]
[본문 내용을 2-3문장으로 요약. **핵심 단어**는 볼드 처리]

**교역자 해설**
[교역자가 전달하는 핵심 메시지를 3-4문장으로 정리. **중요한 개념이나 교훈**은 볼드 처리]

**오늘의 하시조**
- [ ] [구체적인 실천 항목 1]
- [ ] [구체적인 실천 항목 2]
- [ ] [구체적인 실천 항목 3]

## 작성 지침
1. **정중한 존댓말**(~습니다, ~해요)을 사용하세요.
2. **간결하고 명확한 문체**를 사용하세요.
3. 하시조는 **반드시 영상에서 교역자가 제안한 내용만** 작성하세요. AI가 임의로 창작하거나 추가하지 마세요.
4. 각 섹션 제목은 **볼드**로 표시하세요.
5. 핵심 키워드나 중요한 내용은 **볼드**로 강조하세요.
6. 하시조 항목은 `- [ ]` 형식으로 작성하세요.

## 영상 자막
{transcript}
"""
        
        response, model = _generate_content_with_gemini_fallback(
            client=client,
            types=types,
            contents=prompt,
        )
        
        return {
            'summary': response.text,
            'model': model
        }
        
    except Exception as e:
        error_str = str(e)
        logger.error("Error calling Gemini API")
        
        # 할당량 초과 에러인 경우 특별 처리
        if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
            return {'error': 'quota_exceeded', 'message': 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'}
        
        return None


def _is_retryable_gemini_error(error: str) -> bool:
    retryable_markers = ('503', 'UNAVAILABLE', '500', 'INTERNAL', '504', 'DEADLINE_EXCEEDED')
    return any(marker in error for marker in retryable_markers)


def _is_quota_exceeded_gemini_error(error: str) -> bool:
    quota_markers = ('429', 'RESOURCE_EXHAUSTED')
    return any(marker in error for marker in quota_markers)


def _can_try_next_gemini_model(error: str) -> bool:
    return _is_quota_exceeded_gemini_error(error) or (
        'PERMISSION_DENIED' in error and 'unrestricted keys' in error
    )


def _generate_content_with_gemini_fallback(client, types, contents):
    last_error = None
    for model in GEMINI_SUMMARY_MODELS:
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        max_output_tokens=16384,
                    )
                )
                return response, model
            except Exception as e:
                error_str = str(e)
                last_error = e
                if _can_try_next_gemini_model(error_str):
                    logger.warning(f"Gemini model unavailable, trying fallback if available: {model}")
                    break
                if attempt == 2 or not _is_retryable_gemini_error(error_str):
                    raise
                time.sleep(2 ** attempt)

    if last_error:
        raise last_error
    raise RuntimeError("No Gemini summary models configured")


def summarize_youtube_video_with_gemini(video_id: str) -> dict | None:
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if not api_key:
        logger.error("GEMINI_API_KEY not configured")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        prompt = """다음 하세나하시조 YouTube 영상의 음성 내용을 바탕으로 아래 형식에 맞춰 요약해주세요.

## 출력 형식 (반드시 준수)

**오늘의 본문**
[성경 구절 (예: 마태복음 27장 1-10절)]
[본문 내용을 2-3문장으로 요약. **핵심 단어**는 볼드 처리]

**교역자 해설**
[교역자가 전달하는 핵심 메시지를 3-4문장으로 정리. **중요한 개념이나 교훈**은 볼드 처리]

**오늘의 하시조**
- [ ] [구체적인 실천 항목 1]
- [ ] [구체적인 실천 항목 2]
- [ ] [구체적인 실천 항목 3]

## 작성 지침
1. **정중한 존댓말**(~습니다, ~해요)을 사용하세요.
2. **간결하고 명확한 문체**를 사용하세요.
3. 하시조는 **반드시 영상에서 교역자가 제안한 내용만** 작성하세요. AI가 임의로 창작하거나 추가하지 마세요.
4. 각 섹션 제목은 **볼드**로 표시하세요.
5. 핵심 키워드나 중요한 내용은 **볼드**로 강조하세요.
6. 하시조 항목은 `- [ ]` 형식으로 작성하세요.
"""
        response, model = _generate_content_with_gemini_fallback(
            client=client,
            types=types,
            contents=types.Content(
                parts=[
                    types.Part(
                        file_data=types.FileData(
                            file_uri=f'https://www.youtube.com/watch?v={video_id}',
                            mime_type='video/*',
                        )
                    ),
                    types.Part(text=prompt),
                ]
            ),
        )

        return {
            'summary': response.text,
            'model': f'{model}-video'
        }
    except Exception as e:
        error_str = str(e)
        logger.error("Error calling Gemini video API")

        if _is_quota_exceeded_gemini_error(error_str):
            return {'error': 'quota_exceeded', 'message': 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'}

        return None


FAILURE_MESSAGES = {
    'transcript_unavailable': '영상 자막을 가져올 수 없습니다.',
    'generation_failed': 'AI 요약을 생성할 수 없습니다.',
    'quota_exceeded': 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    'storage_failed': 'AI 요약 저장 중 오류가 발생했습니다.',
}


def _summary_data(summary) -> dict:
    return {
        'success': True,
        'video_id': summary.video_id,
        'summary': summary.summary,
        'model': summary.model_used,
        'is_edited': summary.is_edited,
        'video_date': summary.video_date.isoformat() if summary.video_date else None,
        'title': summary.title,
        'persisted': True,
        'cacheable': True,
    }


def get_admin_summary(video_id: str) -> dict:
    from ..models import HasenaSummaryFailure

    result = get_existing_summary(video_id)
    failure = HasenaSummaryFailure.objects.filter(video_id=video_id).first()
    if result['success'] or failure:
        result.update({
            'has_summary': result['success'],
            'status': 'failed' if failure else ('reviewed' if result['is_edited'] else 'review_needed'),
            'error_code': failure.error_code if failure else None,
            'error_message': FAILURE_MESSAGES[failure.error_code] if failure else None,
        })
    return result


def get_existing_summary(video_id: str) -> dict:
    from ..models import HasenaSummary
    
    try:
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        if existing:
            return _summary_data(existing)
        return {
            'success': False,
            'error': '요약이 아직 준비되지 않았습니다.',
            'video_id': video_id
        }
    except Exception as e:
        logger.exception("Error fetching existing summary")
        return {
            'success': False,
            'error': '요약 조회 중 오류가 발생했습니다.',
            'video_id': video_id
        }


def is_cacheable_hasena_summary_result(result: dict) -> bool:
    return bool(
        result.get('success') is True
        and result.get('persisted') is True
        and result.get('cacheable') is True
    )


def require_cacheable_hasena_summary_result(result: dict) -> dict:
    if is_cacheable_hasena_summary_result(result):
        return result

    normalized = result.copy()
    normalized['success'] = False
    normalized['persisted'] = False
    normalized['cacheable'] = False
    normalized.setdefault('error', 'AI 요약 저장 중 오류가 발생했습니다.')
    return normalized


def _record_generation_failure(video_id, error_code, video_date=None, title=None):
    from ..models import HasenaSummaryFailure

    result = {
        'success': False,
        'video_id': video_id,
        'error': FAILURE_MESSAGES[error_code],
        'error_code': error_code,
        'persisted': False,
        'cacheable': False,
        'failure_persisted': False,
    }
    if error_code == 'quota_exceeded':
        result['retry_after'] = 60
    try:
        defaults = {'error_code': error_code}
        if video_date is not None:
            defaults['video_date'] = video_date
        if title is not None:
            defaults['title'] = title
        with transaction.atomic():
            HasenaSummaryFailure.objects.update_or_create(video_id=video_id, defaults=defaults)
        result.update(status='failed', failure_persisted=True)
    except Exception:
        # No exception text: provider/DB exceptions can contain credentials or content.
        logger.error('Could not persist Hasena generation failure')
    return result


def get_hasena_summary(video_id: str, video_date: date = None, title: str = None) -> dict:
    from ..models import HasenaSummary

    try:
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        if existing:
            return _summary_data(existing)
    except Exception:
        logger.error('Error checking existing summary')
        return _record_generation_failure(video_id, 'storage_failed', video_date, title)
    return _generate_summary(video_id, video_date=video_date, title=title)


def _generate_summary(video_id, *, regenerate=False, video_date=None, title=None):
    from ..models import HasenaSummary, HasenaSummaryFailure

    try:
        transcript = get_youtube_transcript(video_id)
        if regenerate and not transcript:
            return _record_generation_failure(video_id, 'transcript_unavailable')
        summary_result = summarize_with_gemini(transcript) if transcript else summarize_youtube_video_with_gemini(video_id)
    except Exception:
        logger.error('Error generating Hasena summary')
        return _record_generation_failure(video_id, 'generation_failed', video_date, title)
    if summary_result and summary_result.get('error') == 'quota_exceeded':
        return _record_generation_failure(video_id, 'quota_exceeded', video_date, title)
    # The provider is a trust boundary: empty/malformed output is not a valid summary.
    if (not summary_result
            or not isinstance(summary_result.get('summary'), str)
            or not summary_result['summary'].strip()
            or not isinstance(summary_result.get('model'), str)
            or not 1 <= len(summary_result['model']) <= 50):
        return _record_generation_failure(video_id, 'generation_failed', video_date, title)

    try:
        with transaction.atomic():
            defaults = {
                'summary': summary_result['summary'],
                'transcript': transcript or '',
                'model_used': summary_result['model'],
                'is_edited': False,
            }
            # Regeneration retains real metadata; failure-only videos may have metadata
            # supplied by cron. No title or publication date is inferred from attempt time.
            failure = HasenaSummaryFailure.objects.filter(video_id=video_id).first()
            create_defaults = {
                **defaults,
                'video_date': video_date if video_date is not None else (failure.video_date if failure else None),
                'title': title if title is not None else (failure.title if failure else ''),
            }
            summary_obj, created = HasenaSummary.objects.update_or_create(
                video_id=video_id, defaults=defaults, create_defaults=create_defaults,
            )
            HasenaSummaryFailure.objects.filter(video_id=video_id).delete()
        result = _summary_data(summary_obj)
        result['created'] = created
        if regenerate:
            result['status'] = 'review_needed'
        return result
    except Exception:
        logger.error('Error saving Hasena summary')
        return _record_generation_failure(video_id, 'storage_failed', video_date, title)


def regenerate_summary_for_video(video_id: str) -> dict:
    return _generate_summary(video_id, regenerate=True)


def update_summary(video_id: str, summary: str, title: str = None) -> dict:
    from ..models import HasenaSummary, HasenaSummaryFailure

    try:
        with transaction.atomic():
            existing = HasenaSummary.objects.select_for_update().filter(video_id=video_id).first()
            if not existing:
                return {
                    'success': False,
                    'error': '해당 영상의 요약을 찾을 수 없습니다.',
                    'video_id': video_id,
                }
            existing.summary = summary
            existing.is_edited = True
            if title is not None:
                existing.title = title
            existing.save()
            HasenaSummaryFailure.objects.filter(video_id=video_id).delete()
        return {
            'success': True,
            'video_id': video_id,
            'summary': existing.summary,
            'title': existing.title,
            'is_edited': True,
            'status': 'reviewed',
        }
    except Exception:
        logger.error('Error updating Hasena summary')
        return {
            'success': False,
            'error': '요약 수정 중 오류가 발생했습니다.',
            'error_code': 'storage_failed',
            'video_id': video_id,
        }


def list_summaries(page: int = 1, page_size: int = 20, status: str = 'all') -> dict:
    from django.db.models import BooleanField, Case, CharField, F, IntegerField, OuterRef, Subquery, TextField, Value, When
    from django.db.models.functions import Coalesce, Substr
    from ..models import HasenaSummary, HasenaSummaryFailure

    failure = HasenaSummaryFailure.objects.filter(video_id=OuterRef('video_id'))
    summaries = HasenaSummary.objects.order_by().annotate(
        row_id=F('id'),
        summary_text=Substr('summary', 1, 201),
        has_summary=Value(True, output_field=BooleanField()),
        error_code=Subquery(failure.values('error_code')[:1]),
        activity_at=Coalesce(Subquery(failure.values('updated_at')[:1]), 'updated_at'),
        sort_created=F('created_at'),
    ).annotate(status=Case(
        When(error_code__isnull=False, then=Value('failed')),
        When(is_edited=True, then=Value('reviewed')),
        default=Value('review_needed'), output_field=CharField(),
    ))
    failures = HasenaSummaryFailure.objects.exclude(
        video_id__in=HasenaSummary.objects.order_by().values('video_id'),
    ).annotate(
        row_id=Value(None, output_field=IntegerField()),
        summary_text=Value(None, output_field=TextField()),
        is_edited=Value(None, output_field=BooleanField()),
        model_used=Value(None, output_field=CharField()),
        has_summary=Value(False, output_field=BooleanField()),
        status=Value('failed', output_field=CharField()),
        activity_at=F('updated_at'),
        sort_created=F('created_at'),
    )
    if status != 'all':
        summaries = summaries.filter(status=status)
        failures = failures.filter(status=status)
    fields = (
        'row_id', 'video_id', 'video_date', 'title', 'summary_text', 'is_edited',
        'model_used', 'has_summary', 'status', 'error_code', 'activity_at', 'sort_created',
    )
    rows = summaries.values(*fields).union(failures.values(*fields), all=True).order_by(
        '-video_date', '-sort_created', 'video_id',
    )
    total = rows.count()
    offset = (page - 1) * page_size
    items = []
    for row in rows[offset:offset + page_size]:
        preview = row.pop('summary_text')
        row['summary_preview'] = preview[:200] + '...' if preview is not None and len(preview) > 200 else preview
        row['id'] = row.pop('row_id')
        row['video_date'] = row['video_date'].isoformat() if row['video_date'] else None
        row['updated_at'] = row.pop('activity_at').isoformat()
        row.pop('sort_created')
        row['error_message'] = FAILURE_MESSAGES[row['error_code']] if row['error_code'] else None
        items.append(row)
    return {
        'success': True, 'total': total, 'page': page, 'page_size': page_size,
        'summaries': items,
    }
