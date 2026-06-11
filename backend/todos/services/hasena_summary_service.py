import logging
import requests
from datetime import date
from django.conf import settings

logger = logging.getLogger(__name__)

# 하세나하시조 플레이리스트 ID
HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'


def get_latest_hasena_video() -> dict | None:
    """
    하세나 플레이리스트에서 최신 영상 정보를 가져옴
    Returns: {'video_id': str, 'title': str, 'published_at': str} or None
    """
    api_key = getattr(settings, 'YOUTUBE_API_KEY', None)
    if not api_key:
        # YOUTUBE_API_KEY가 없으면 GEMINI_API_KEY 시도 (같은 Google Cloud 프로젝트인 경우)
        api_key = getattr(settings, 'GEMINI_API_KEY', None)
    
    if not api_key:
        logger.error("No YouTube API key configured")
        return None
    
    try:
        url = 'https://www.googleapis.com/youtube/v3/playlistItems'
        params = {
            'part': 'snippet,status',
            'playlistId': HASENA_PLAYLIST_ID,
            'maxResults': 10,
            'key': api_key
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if not data.get('items'):
            logger.warning("No videos found in playlist")
            return None
        
        for item in data['items']:
            snippet = item.get('snippet', {})
            status = item.get('status', {})
            video_id = snippet.get('resourceId', {}).get('videoId')
            title = snippet.get('title') or ''
            privacy_status = status.get('privacyStatus')

            if not video_id or title.lower() == 'private video' or privacy_status == 'private':
                continue

            return {
                'video_id': video_id,
                'title': title,
                'published_at': snippet.get('publishedAt'),
            }
        
        logger.warning("No public videos found in playlist")
        return None
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching playlist: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching playlist: {str(e)}")
        return None


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
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=16384,
            )
        )
        
        return {
            'summary': response.text,
            'model': 'gemini-2.5-flash'
        }
        
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error calling Gemini API: {error_str}")
        
        # 할당량 초과 에러인 경우 특별 처리
        if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
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
                'transcript': transcript,
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
