import logging
import requests
import time
import re
import json
import xml.etree.ElementTree as ET
from datetime import date
from django.conf import settings

logger = logging.getLogger(__name__)

# 하세나하시조 플레이리스트 ID
HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'
GEMINI_SUMMARY_MODELS = ('gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite')


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
        logger.warning(f"Error fetching playlist feed: {str(e)}")
        return []
    except ET.ParseError as e:
        logger.warning(f"Error parsing playlist feed: {str(e)}")
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
        logger.warning(f"Error fetching playlist page: {str(e)}")
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
            'part': 'snippet,status',
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
            status = item.get('status', {})
            video_id = snippet.get('resourceId', {}).get('videoId')
            title = snippet.get('title') or ''
            privacy_status = status.get('privacyStatus')

            if not video_id or title.lower() == 'private video' or privacy_status == 'private':
                continue

            videos.append({
                'video_id': video_id,
                'title': title,
                'published_at': snippet.get('publishedAt'),
            })
        
        if not videos:
            logger.warning("No public videos found in playlist")
        return videos
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching playlist: {_redact_api_keys(str(e))}")
        return []
    except Exception as e:
        logger.error(f"Unexpected error fetching playlist: {str(e)}")
        return []


def get_latest_hasena_video() -> dict | None:
    videos = get_recent_hasena_videos()
    return videos[0] if videos else None


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
        logger.error(f"Error fetching transcript for {video_id}: {str(e)}")
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
        logger.error(f"Error calling Gemini API: {error_str}")
        
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
        logger.error(f"Error calling Gemini video API: {error_str}")

        if _is_quota_exceeded_gemini_error(error_str):
            return {'error': 'quota_exceeded', 'message': 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'}

        return None


def get_existing_summary(video_id: str) -> dict:
    from ..models import HasenaSummary
    
    try:
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        if existing:
            return {
                'success': True,
                'video_id': video_id,
                'summary': existing.summary,
                'model': existing.model_used,
                'is_edited': existing.is_edited,
                'video_date': existing.video_date.isoformat() if existing.video_date else None,
                'title': existing.title,
            }
        return {
            'success': False,
            'error': '요약이 아직 준비되지 않았습니다.',
            'video_id': video_id
        }
    except Exception as e:
        logger.error(f"Error fetching existing summary: {str(e)}")
        return {
            'success': False,
            'error': '요약 조회 중 오류가 발생했습니다.',
            'video_id': video_id
        }


def get_hasena_summary(video_id: str, video_date: date = None, title: str = None) -> dict:
    from ..models import HasenaSummary
    
    try:
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        if existing:
            return {
                'success': True,
                'video_id': video_id,
                'summary': existing.summary,
                'model': existing.model_used,
                'is_edited': existing.is_edited,
                'video_date': existing.video_date.isoformat() if existing.video_date else None,
                'title': existing.title,
            }
    except Exception as e:
        logger.error(f"Error checking existing summary: {str(e)}")
    
    transcript = get_youtube_transcript(video_id)
    summary_result = summarize_with_gemini(transcript) if transcript else summarize_youtube_video_with_gemini(video_id)
    if not summary_result:
        return {
            'success': False,
            'error': 'AI 요약을 생성할 수 없습니다.',
            'video_id': video_id
        }
    
    # 할당량 초과 에러 처리
    if summary_result.get('error') == 'quota_exceeded':
        return {
            'success': False,
            'error': summary_result.get('message', 'API 할당량 초과'),
            'video_id': video_id,
            'retry_after': 60
        }
    
    try:
        summary_obj, created = HasenaSummary.objects.update_or_create(
            video_id=video_id,
            defaults={
                'summary': summary_result['summary'],
                'transcript': transcript or '',
                'model_used': summary_result['model'],
                'video_date': video_date,
                'title': title or '',
                'is_edited': False,
            }
        )
        
        return {
            'success': True,
            'video_id': video_id,
            'summary': summary_obj.summary,
            'model': summary_obj.model_used,
            'is_edited': summary_obj.is_edited,
            'video_date': summary_obj.video_date.isoformat() if summary_obj.video_date else None,
            'title': summary_obj.title,
            'created': created,
        }
        
    except Exception as e:
        logger.error(f"Error saving summary: {str(e)}")
        return {
            'success': True,
            'video_id': video_id,
            'summary': summary_result['summary'],
            'model': summary_result['model'],
        }


def regenerate_summary_for_video(video_id: str) -> dict:
    from ..models import HasenaSummary
    
    transcript = get_youtube_transcript(video_id)
    if not transcript:
        return {
            'success': False,
            'error': '영상 자막을 가져올 수 없습니다.',
            'video_id': video_id
        }
    
    summary_result = summarize_with_gemini(transcript)
    if not summary_result:
        return {
            'success': False,
            'error': 'AI 요약을 생성할 수 없습니다.',
            'video_id': video_id
        }
    
    try:
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        
        if existing:
            existing.summary = summary_result['summary']
            existing.transcript = transcript
            existing.model_used = summary_result['model']
            existing.is_edited = False
            existing.save()
            summary_obj = existing
        else:
            summary_obj = HasenaSummary.objects.create(
                video_id=video_id,
                summary=summary_result['summary'],
                transcript=transcript,
                model_used=summary_result['model'],
            )
        
        return {
            'success': True,
            'video_id': video_id,
            'summary': summary_obj.summary,
            'model': summary_obj.model_used,
        }
        
    except Exception as e:
        logger.error(f"Error regenerating summary: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'video_id': video_id
        }


def update_summary(video_id: str, summary: str, title: str = None) -> dict:
    from ..models import HasenaSummary
    
    try:
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        
        if not existing:
            return {
                'success': False,
                'error': '해당 영상의 요약을 찾을 수 없습니다.',
                'video_id': video_id
            }
        
        existing.summary = summary
        existing.is_edited = True
        if title:
            existing.title = title
        existing.save()
        
        return {
            'success': True,
            'video_id': video_id,
            'summary': existing.summary,
            'title': existing.title,
            'is_edited': True,
        }
        
    except Exception as e:
        logger.error(f"Error updating summary: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'video_id': video_id
        }


def list_summaries(page: int = 1, page_size: int = 20) -> dict:
    from ..models import HasenaSummary
    
    try:
        total = HasenaSummary.objects.count()
        offset = (page - 1) * page_size
        
        summaries = HasenaSummary.objects.all()[offset:offset + page_size]
        
        return {
            'success': True,
            'total': total,
            'page': page,
            'page_size': page_size,
            'summaries': [
                {
                    'id': s.id,
                    'video_id': s.video_id,
                    'video_date': s.video_date.isoformat() if s.video_date else None,
                    'title': s.title,
                    'summary_preview': s.summary[:200] + '...' if len(s.summary) > 200 else s.summary,
                    'is_edited': s.is_edited,
                    'model_used': s.model_used,
                    'updated_at': s.updated_at.isoformat(),
                }
                for s in summaries
            ]
        }
        
    except Exception as e:
        logger.error(f"Error listing summaries: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
