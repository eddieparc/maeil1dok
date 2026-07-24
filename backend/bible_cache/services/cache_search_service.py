import hashlib
import json
import re
from dataclasses import dataclass
from html import unescape

from django.conf import settings
from django.core.cache import cache as django_cache
from django.db.models import Q
from django.utils.html import strip_tags

from bible_cache.models import BibleContentCache


SEARCH_CACHE_VERSION = 'v2'
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
        normalized_query = query.strip()
        if not normalized_query:
            return []

        normalized_version = version.upper() if version else None
        cache_key = BibleCacheSearchService._cache_key(normalized_query, normalized_version)
        cached_results = django_cache.get(cache_key)
        if isinstance(cached_results, list):
            return cached_results

        queryset = BibleContentCache.objects.filter(
            fetch_success=True,
        ).filter(
            Q(content__icontains=normalized_query) | Q(content_type='json'),
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
        digest = hashlib.sha256(f'{version or "ALL"}:{query.lower()}'.encode('utf-8')).hexdigest()
        return f'bible-cache-search:{SEARCH_CACHE_VERSION}:{digest}'

    @staticmethod
    def _ordered(queryset):
        return sorted(
            queryset.order_by('version', 'chapter'),
            key=lambda cache: (BOOK_ORDER.get(cache.book, 999), cache.version, cache.chapter),
        )

    @staticmethod
    def _snippet(content: str, query: str) -> str:
        text = BibleCacheSearchService._plain_text(content)
        normalized = BibleCacheSearchService._clean_text(text)
        index = normalized.lower().find(query.lower())
        if index < 0:
            return normalized[:160]

        start = max(0, index - 60)
        end = min(len(normalized), index + len(query) + 100)
        prefix = '...' if start > 0 else ''
        suffix = '...' if end < len(normalized) else ''
        return f'{prefix}{normalized[start:end]}{suffix}'

    @staticmethod
    def _plain_text(content: str) -> str:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return strip_tags(content)

        if not isinstance(parsed, dict):
            return strip_tags(content)

        verses = parsed.get('verses')
        if isinstance(verses, list):
            return ' '.join(
                verse.get('text', '')
                for verse in verses
                if isinstance(verse, dict) and isinstance(verse.get('text'), str)
            )

        return strip_tags(content)

    @staticmethod
    def _matching_verse_hit(content: str, query: str) -> BibleCacheVerseSearchHit | None:
        normalized_query = query.lower()
        for verse in BibleCacheSearchService._verse_texts(content):
            if normalized_query in verse.text.lower():
                return verse

        return None

    @staticmethod
    def _matching_verse(content: str, query: str) -> int | None:
        hit = BibleCacheSearchService._matching_verse_hit(content, query)
        return hit.verse if hit else None

    @staticmethod
    def _verse_texts(content: str) -> list[BibleCacheVerseSearchHit]:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return BibleCacheSearchService._verse_texts_from_html(content)

        if isinstance(parsed, dict):
            verses = parsed.get('verses')
            if isinstance(verses, list):
                hits: list[BibleCacheVerseSearchHit] = []
                for verse in verses:
                    if not isinstance(verse, dict):
                        continue
                    verse_text = verse.get('text')
                    verse_number = verse.get('verse')
                    if isinstance(verse_text, str):
                        hits.append(
                            BibleCacheVerseSearchHit(
                                verse=verse_number if isinstance(verse_number, int) else None,
                                text=BibleCacheSearchService._clean_text(verse_text),
                            )
                        )
                return hits

        if isinstance(parsed, list):
            text = BibleCacheSearchService._clean_text(' '.join(str(item) for item in parsed))
            return [BibleCacheVerseSearchHit(verse=None, text=text)] if text else []

        text = BibleCacheSearchService._clean_text(strip_tags(content))
        return [BibleCacheVerseSearchHit(verse=None, text=text)] if text else []

    @staticmethod
    def _verse_texts_from_html(content: str) -> list[BibleCacheVerseSearchHit]:
        verses = [
            BibleCacheVerseSearchHit(
                verse=int(match.group(1)),
                text=BibleCacheSearchService._clean_text(match.group(2)),
            )
            for match in re.finditer(
                r'<span\b[^>]*>\s*<span\b[^>]*class=["\']number["\'][^>]*>\s*(\d{1,3})(?:&nbsp;|\s)*</span>([\s\S]*?)</span>\s*<br\s*/?>',
                content,
                re.IGNORECASE,
            )
        ]
        if verses:
            return verses

        simple_span_verses = [
            BibleCacheVerseSearchHit(
                verse=int(match.group(1)),
                text=BibleCacheSearchService._clean_text(match.group(2)),
            )
            for match in re.finditer(
                r'<span\b[^>]*>\s*(\d{1,3})(?:&nbsp;|\s)+([\s\S]*?)</span>',
                content,
                re.IGNORECASE,
            )
        ]
        if simple_span_verses:
            return simple_span_verses

        text = BibleCacheSearchService._clean_text(strip_tags(content))
        return [BibleCacheVerseSearchHit(verse=None, text=text)] if text else []

    @staticmethod
    def _clean_text(text: str) -> str:
        decoded = unescape(strip_tags(text)).replace('\xa0', ' ')
        without_source_noise = re.sub(r'\s*직접입력\s*\[[^\]]+\]\s*', ' ', decoded)
        return re.sub(r'\s+', ' ', without_source_noise).strip()
