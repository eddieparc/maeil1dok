"""
성경 본문 캐시 API 뷰
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from bible_cache.services import BibleFetchService
from bible_cache.services.bible_fetch_service import BibleFetchError, SUPPORTED_VERSIONS
from bible_cache.services.cache_search_service import BibleCacheSearchService

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_bible_content(request, version: str, book: str, chapter: int):
    """
    성경 본문 조회 API

    캐시에서 먼저 조회하고, 없으면 원본에서 가져와 캐싱 후 반환

    URL: GET /api/v1/bible-cache/{version}/{book}/{chapter}/

    Path Parameters:
        version: 번역본 코드 (GAE, KNT, HAN, SAE, SAENEW, COG, COGNEW)
        book: 성경책 코드 (gen, exo, mat 등)
        chapter: 장 번호

    Query Parameters:
        force_refresh: 캐시 무시하고 강제 새로고침 (optional, default=false)

    Response:
        200: {
            "success": true,
            "data": {
                "version": "GAE",
                "book": "gen",
                "chapter": 1,
                "content": "...",
                "content_type": "html",
                "from_cache": true
            }
        }
        400: 잘못된 요청 (지원하지 않는 버전, 잘못된 장 번호 등)
        503: 원본 서버 및 캐시 모두에서 데이터를 가져올 수 없음
    """
    # 입력 검증
    version = version.upper()
    book = book.lower()

    if version not in SUPPORTED_VERSIONS:
        return Response(
            {
                'success': False,
                'error': f'지원하지 않는 번역본입니다: {version}',
                'supported_versions': list(SUPPORTED_VERSIONS)
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if chapter < 1:
        return Response(
            {
                'success': False,
                'error': '장 번호는 1 이상이어야 합니다.'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # 강제 새로고침 옵션
    force_refresh = request.query_params.get('force_refresh', 'false').lower() == 'true'

    try:
        content, content_type, from_cache = BibleFetchService.get_bible_content(
            version=version,
            book=book,
            chapter=chapter,
            force_refresh=force_refresh
        )

        return Response({
            'success': True,
            'data': {
                'version': version,
                'book': book,
                'chapter': chapter,
                'content': content,
                'content_type': content_type,
                'from_cache': from_cache
            }
        })

    except BibleFetchError as e:
        logger.error(f"성경 본문 조회 실패: {version}:{book}:{chapter} - {e}")
        return Response(
            {
                'success': False,
                'error': str(e),
                'fallback_url': _get_fallback_url(version, book, chapter)
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_cache_status(request, version: str, book: str, chapter: int):
    """
    캐시 상태 확인 API

    URL: GET /api/v1/bible-cache/{version}/{book}/{chapter}/status/

    Response:
        200: {
            "cached": true,
            "updated_at": "2024-01-01T00:00:00Z",
            "fetch_success": true
        }
    """
    from bible_cache.models import BibleContentCache

    version = version.upper()
    book = book.lower()

    cached = BibleContentCache.get_cached_content(version, book, chapter)

    if cached:
        return Response({
            'cached': True,
            'updated_at': cached.updated_at.isoformat(),
            'fetch_success': cached.fetch_success,
            'content_type': cached.content_type
        })
    else:
        return Response({
            'cached': False
        })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_supported_versions(request):
    """
    지원하는 번역본 목록 조회

    URL: GET /api/v1/bible-cache/versions/
    """
    VERSION_NAMES = {
        # 한글 역본
        'KNT': '새한글',
        'GAE': '개역개정',
        'HAN': '개역한글',
        'SAE': '표준새번역',
        'SAENEW': '새번역',
        'COG': '공동번역',
        'COGNEW': '공동번역 개정판',
        'WOORI': '우리말성경',
        # 원어 역본
        'HEB': '히브리어 (WLC)',
        'GRK': '헬라어 (SBLGNT)',
        # 영어 역본
        'KJV': 'KJV',
        'WEB': 'WEB',
        'ASV': 'ASV',
    }

    versions = [
        {'code': code, 'name': VERSION_NAMES.get(code, code)}
        for code in sorted(SUPPORTED_VERSIONS)
    ]

    return Response({
        'versions': versions
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def search_cached_content(request):
    query = request.query_params.get('q', '').strip()
    version_param = request.query_params.get('version')
    version = version_param.strip() if version_param else None
    limit_param = request.query_params.get('limit', '20')

    if len(query) < 2:
        return Response(
            {
                'success': False,
                'error': '검색어는 두 글자 이상 입력해주세요.'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if version and version.upper() not in SUPPORTED_VERSIONS:
        return Response(
            {
                'success': False,
                'error': f'지원하지 않는 번역본입니다: {version}',
                'supported_versions': list(SUPPORTED_VERSIONS)
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        limit = min(max(int(limit_param), 1), 50)
    except ValueError:
        limit = 20

    results = BibleCacheSearchService.search(
        query=query,
        version=version,
        limit=limit,
    )

    return Response({
        'success': True,
        'query': query,
        'count': len(results),
        'results': [
            {
                'version': result.version,
                'book': result.book,
                'chapter': result.chapter,
                'snippet': result.snippet,
                'updated_at': result.updated_at,
            }
            for result in results
        ],
    })


def _get_fallback_url(version: str, book: str, chapter: int) -> str:
    """직접 링크 생성 (대한성서공회 또는 두라노)"""
    if version == 'KNT':
        return f"https://www.bskorea.or.kr/KNT/index.php?chapter={book.upper()}.{chapter}"
    elif version == 'WOORI':
        # 두라노 우리말성경 직접 링크
        from bible_cache.services.woori_bible_service import WOORI_BOOK_CODE_MAP
        vl = WOORI_BOOK_CODE_MAP.get(book.lower(), 1)
        return f"https://www.duranno.com/bdictionary/result_woori.asp?s=r&kd=104&vl={vl}&ct={chapter}"
    else:
        return f"https://www.bskorea.or.kr/bible/korbibReadpage.php?version={version}&book={book}&chap={chapter}"
