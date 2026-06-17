"""
성경 본문 Fetch 서비스

bskorea.or.kr에서 성경 본문을 가져오고 캐싱하는 서비스
"""

import logging
import requests
import threading
from typing import Tuple
from datetime import timedelta
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from bible_cache.models import BibleContentCache
from bible_cache.services.bible_fetch_service_constants import (
    BSKOREA_BASE_URL,
    REQUEST_TIMEOUT,
)
from bible_cache.services.cache_refresh_coordinator import CacheRefreshCoordinator
from bible_cache.services.knt_bible_service import KntBibleService
from bible_cache.services.woori_bible_service import WooriBibleService

logger = logging.getLogger(__name__)

# 지연 임포트를 위한 API.Bible 서비스 참조
_api_bible_service = None

def get_api_bible_service():
    """API.Bible 서비스 지연 로딩 (순환 참조 방지)"""
    global _api_bible_service
    if _api_bible_service is None:
        from bible_cache.services.api_bible_service import ApiBibleService
        _api_bible_service = ApiBibleService
    return _api_bible_service

# 지원하는 번역본 목록
SUPPORTED_VERSIONS = frozenset({
    # 한글 역본
    'KNT',      # 새한글성경
    'GAE',      # 개역개정
    'HAN',      # 개역한글
    'SAE',      # 표준새번역
    'SAENEW',   # 새번역
    'COG',      # 공동번역
    'COGNEW',   # 공동번역 개정판
    'WOORI',    # 우리말성경 (두라노)
    # 원어/영어 역본 (API.Bible)
    'HEB',      # 히브리어 (Westminster Leningrad Codex)
    'GRK',      # 헬라어 (SBL Greek New Testament)
    'KJV',      # 영어 (King James Version)
    'WEB',      # 영어 (World English Bible)
    'ASV',      # 영어 (American Standard Version)
})

# API.Bible 역본 목록 (외부 API 사용)
API_BIBLE_VERSIONS = frozenset({'HEB', 'GRK', 'KJV', 'WEB', 'ASV'})

BIBLE_CACHE_REFRESH_AFTER_DAYS = 90
BIBLE_CACHE_REFRESH_RETRY_AFTER_SECONDS = 300

class BibleFetchError(Exception):
    """성경 본문 가져오기 실패 예외"""
    pass


class BibleFetchService:
    """성경 본문 Fetch 서비스"""

    @staticmethod
    def get_bible_content(
        version: str,
        book: str,
        chapter: int,
        force_refresh: bool = False
    ) -> Tuple[str, str, bool]:
        """
        성경 본문 가져오기 (캐시 우선, fallback으로 원본 fetch)

        Args:
            version: 번역본 코드
            book: 성경책 코드
            chapter: 장 번호
            force_refresh: 캐시 무시하고 강제 새로고침

        Returns:
            Tuple[content, content_type, from_cache]
            - content: 성경 본문 (HTML/JSON)
            - content_type: 'html' 또는 'json'
            - from_cache: 캐시에서 가져왔는지 여부

        Raises:
            BibleFetchError: 원본에서도 캐시에서도 가져오기 실패
        """
        version = version.upper()
        book = book.lower()

        # 버전 유효성 검사
        if version not in SUPPORTED_VERSIONS:
            raise BibleFetchError(f"지원하지 않는 번역본: {version}")

        # 1. 캐시 확인 (force_refresh가 아닌 경우)
        if not force_refresh:
            cached = BibleContentCache.get_cached_content(version, book, chapter)
            if cached and cached.fetch_success:
                if not BibleFetchService._is_stale(cached):
                    logger.debug(f"Cache hit: {version}:{book}:{chapter}")
                    return cached.content, cached.content_type, True
                logger.info(f"Refreshing stale cache: {version}:{book}:{chapter}")
                BibleFetchService._schedule_refresh(version, book, chapter)
                return cached.content, cached.content_type, True

        # 2. 원본에서 fetch 시도
        try:
            content, content_type, _source_url = BibleFetchService._refresh_cache_from_source(
                version, book, chapter
            )
            logger.info(f"Fetched and cached: {version}:{book}:{chapter}")
            return content, content_type, False

        except Exception as e:
            logger.warning(f"원본 fetch 실패: {version}:{book}:{chapter} - {e}")

            # 3. 원본 실패 시 캐시에서 조회 (stale 허용)
            cached = BibleContentCache.get_cached_content(version, book, chapter)
            if cached:
                logger.info(f"Using stale cache: {version}:{book}:{chapter}")
                return cached.content, cached.content_type, True

            # 4. 캐시도 없으면 에러
            raise BibleFetchError(
                f"성경 본문을 가져올 수 없습니다: {version}:{book}:{chapter}"
            )

    @staticmethod
    def _is_stale(cache: BibleContentCache) -> bool:
        refresh_days = getattr(
            settings,
            'BIBLE_CACHE_REFRESH_AFTER_DAYS',
            BIBLE_CACHE_REFRESH_AFTER_DAYS,
        )
        stale_before = timezone.now() - timedelta(days=refresh_days)
        return cache.updated_at <= stale_before

    @staticmethod
    def _schedule_refresh(version: str, book: str, chapter: int) -> None:
        cache_key = BibleContentCache.generate_cache_key(version, book, chapter)
        retry_after = getattr(
            settings,
            'BIBLE_CACHE_REFRESH_RETRY_AFTER_SECONDS',
            BIBLE_CACHE_REFRESH_RETRY_AFTER_SECONDS,
        )
        if not CacheRefreshCoordinator.claim(cache_key, retry_after):
            return

        try:
            thread = threading.Thread(
                target=BibleFetchService._refresh_cache_safely,
                args=(version, book, chapter, cache_key),
                daemon=True,
            )
            thread.start()
        except RuntimeError:
            CacheRefreshCoordinator.release(cache_key, success=False)
            raise

    @staticmethod
    def _refresh_cache_safely(
        version: str,
        book: str,
        chapter: int,
        cache_key: str,
    ) -> None:
        close_old_connections()
        success = False
        try:
            BibleFetchService._refresh_cache_from_source(version, book, chapter)
            success = True
        except Exception as e:
            logger.warning(f"백그라운드 캐시 갱신 실패: {version}:{book}:{chapter} - {e}")
        finally:
            CacheRefreshCoordinator.release(cache_key, success)
            close_old_connections()

    @staticmethod
    def _refresh_cache_from_source(version: str, book: str, chapter: int) -> Tuple[str, str, str]:
        content, content_type, source_url = BibleFetchService._fetch_from_source(
            version, book, chapter
        )
        BibleContentCache.save_to_cache(
            version=version,
            book=book,
            chapter=chapter,
            content=content,
            content_type=content_type,
            source_url=source_url,
            fetch_success=True
        )
        return content, content_type, source_url

    @staticmethod
    def _fetch_from_source(
        version: str,
        book: str,
        chapter: int
    ) -> Tuple[str, str, str]:
        """
        원본 소스에서 성경 본문 직접 가져오기

        Returns:
            Tuple[content, content_type, source_url]
        """
        # API.Bible 역본인 경우
        if version in API_BIBLE_VERSIONS:
            ApiBibleService = get_api_bible_service()
            return ApiBibleService.fetch_chapter(version, book, chapter)
        
        # 한글 역본
        if version == 'KNT':
            return KntBibleService.fetch(book, chapter)
        elif version == 'WOORI':
            return WooriBibleService.fetch(book, chapter)
        else:
            return BibleFetchService._fetch_standard(version, book, chapter)

    @staticmethod
    def _fetch_standard(
        version: str,
        book: str,
        chapter: int
    ) -> Tuple[str, str, str]:
        """
        표준 번역본 가져오기 (GAE, HAN, SAE 등)

        표준 번역본은 HTML 형식으로 응답
        """
        url = f"{BSKOREA_BASE_URL}/bible/korbibReadpage.php"
        params = {
            'version': version,
            'book': book,
            'chap': chapter,
            'sec': 1,
            'cVersion': '',
            'fontSize': '15px',
            'fontWeight': 'normal',
        }

        response = requests.get(
            url,
            params=params,
            timeout=REQUEST_TIMEOUT,
            headers={
                'User-Agent': 'Maeil1Dok/1.0',
                'Accept': 'text/html',
            }
        )
        response.raise_for_status()

        # HTML 응답 검증 (기본적인 검증만)
        if not response.text or len(response.text) < 100:
            raise BibleFetchError(f"빈 응답: {version}:{book}:{chapter}")

        source_url = response.url
        return response.text, 'html', source_url

    @staticmethod
    def prefetch_chapter_range(
        version: str,
        book: str,
        start_chapter: int,
        end_chapter: int
    ) -> dict:
        """
        여러 장을 미리 캐싱 (백그라운드 작업용)

        Returns:
            dict: {'success': [...], 'failed': [...]}
        """
        results = {'success': [], 'failed': []}

        for chapter in range(start_chapter, end_chapter + 1):
            try:
                BibleFetchService.get_bible_content(
                    version, book, chapter, force_refresh=False
                )
                results['success'].append(chapter)
            except BibleFetchError as e:
                logger.error(f"Prefetch 실패: {version}:{book}:{chapter} - {e}")
                results['failed'].append({'chapter': chapter, 'error': str(e)})

        return results
