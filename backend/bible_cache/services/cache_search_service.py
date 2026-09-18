import hashlib
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache as django_cache
from django.db.models import Q

from bible_cache.models import BibleContentCache
from bible_cache.text_utils import (
    clean_text,
    find_normalized_index,
    normalize_for_search,
    plain_text,
    verse_texts,
)


SEARCH_CACHE_VERSION = 'v3'
SEARCH_CACHE_TIMEOUT_SECONDS = getattr(settings, 'BIBLE_SEARCH_CACHE_TIMEOUT_SECONDS', 60 * 60 * 24)

BOOK_ORDER = {
    'gen': 1, 'exo': 2, 'lev': 3, 'num': 4, 'deu': 5, 'jos': 6, 'jdg': 7,
    'rut': 8, '1sa': 9, '2sa': 10, '1ki': 11, '2ki': 12, '1ch': 13,
    '2ch': 14, 'ezr': 15, 'neh': 16, 'est': 17, 'job': 18, 'psa': 19,
    'pro': 20, 'ecc': 21, 'sng': 22, 'isa': 23, 'jer': 24, 'lam': 25,
    'ezk': 26, 'dan': 27, 'hos': 28, 'jol': 29, 'amo': 30, 'oba': 31,
    'jnh': 32, 'mic': 33, 'nam': 34, 'hab': 35, 'zep': 36, 'hag': 37,
    'zec': 38, 'mal': 39, 'mat': 40, 'mrk': 41, 'luk': 42, 'jhn': 43,
    'act': 44, 'rom': 45, '1co': 46, '2co': 47, 'gal': 48, 'eph': 49,
    'php': 50, 'col': 51, '1th': 52, '2th': 53, '1ti': 54, '2ti': 55,
    'tit': 56, 'phm': 57, 'heb': 58, 'jas': 59, '1pe': 60, '2pe': 61,
    '1jn': 62, '2jn': 63, '3jn': 64, 'jud': 65, 'rev': 66,
}


@dataclass(frozen=True, slots=True)
class BibleCacheSearchResult:
    version: str
    book: str
    chapter: int
    verse: int | None
    snippet: str
    updated_at: str


@dataclass(frozen=True, slots=True)
class BibleCacheVerseSearchHit:
    verse: int | None
    text: str


class BibleCacheSearchService:
    @staticmethod
    def search(
        query: str,
        version: str | None = None,
        limit: int | None = None,
    ) -> list[BibleCacheSearchResult]:
        del limit  # kept for backward-compatible call sites; search returns all matches.
        normalized_query = normalize_for_search(query)
        if not normalized_query:
            return []

        normalized_version = version.upper() if version else None
        cache_key = BibleCacheSearchService._cache_key(normalized_query, normalized_version)
        cached_results = django_cache.get(cache_key)
        if isinstance(cached_results, list):
            return cached_results

        # search_text는 저장 시점에 정규화된 평문이라 태그·엔티티·공백·
        # 결합 문자 차이로 인한 미스가 없다. 아직 백필되지 않은 행을 위해
        # 원본 content 매칭도 함께 둔다.
        queryset = BibleContentCache.objects.filter(
            fetch_success=True,
        ).filter(
            Q(search_text__icontains=normalized_query)
            | Q(content__icontains=normalized_query)
            | Q(content_type='json'),
        )
        if normalized_version:
            queryset = queryset.filter(version=normalized_version)

        results: list[BibleCacheSearchResult] = []
        for cache in BibleCacheSearchService._ordered(queryset):
            hit = BibleCacheSearchService._matching_verse_hit(cache.content, normalized_query)
            if hit is None:
                continue

            results.append(
                BibleCacheSearchResult(
                    version=cache.version,
                    book=cache.book,
                    chapter=cache.chapter,
                    verse=hit.verse,
                    snippet=BibleCacheSearchService._snippet(hit.text, normalized_query),
                    updated_at=cache.updated_at.isoformat(),
                )
            )

        django_cache.set(cache_key, results, SEARCH_CACHE_TIMEOUT_SECONDS)
        return results

    @staticmethod
    def _cache_key(query: str, version: str | None) -> str:
        digest = hashlib.sha256(f'{version or "ALL"}:{query}'.encode('utf-8')).hexdigest()
        return f'bible-cache-search:{SEARCH_CACHE_VERSION}:{digest}'

    @staticmethod
    def _ordered(queryset):
        return sorted(
            queryset.order_by('version', 'chapter'),
            key=lambda cache: (BOOK_ORDER.get(cache.book, 999), cache.version, cache.chapter),
        )

    @staticmethod
    def _snippet(content: str, normalized_query: str) -> str:
        text = plain_text(content)
        normalized = clean_text(text)
        index = find_normalized_index(normalized, normalized_query)
        if index < 0:
            return normalized[:160]

        start = max(0, index - 60)
        end = min(len(normalized), index + len(normalized_query) + 100)
        prefix = '...' if start > 0 else ''
        suffix = '...' if end < len(normalized) else ''
        return f'{prefix}{normalized[start:end]}{suffix}'

    @staticmethod
    def _matching_verse_hit(content: str, normalized_query: str) -> BibleCacheVerseSearchHit | None:
        for verse in verse_texts(content):
            if normalized_query in normalize_for_search(verse.text):
                return BibleCacheVerseSearchHit(verse=verse.verse, text=verse.text)

        return None

    @staticmethod
    def _matching_verse(content: str, normalized_query: str) -> int | None:
        hit = BibleCacheSearchService._matching_verse_hit(content, normalized_query)
        return hit.verse if hit else None
