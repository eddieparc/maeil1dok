import json
import re
from dataclasses import dataclass
from html import unescape

from django.db.models import QuerySet
from django.utils.html import strip_tags

from bible_cache.models import BibleContentCache


@dataclass(frozen=True, slots=True)
class BibleCacheSearchResult:
    version: str
    book: str
    chapter: int
    verse: int | None
    snippet: str
    updated_at: str


class BibleCacheSearchService:
    @staticmethod
    def search(
        query: str,
        version: str | None = None,
        limit: int = 20,
    ) -> list[BibleCacheSearchResult]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        queryset = BibleContentCache.objects.filter(
            fetch_success=True,
            content__icontains=normalized_query,
        )
        if version:
            queryset = queryset.filter(version=version.upper())

        return [
            BibleCacheSearchResult(
                version=cache.version,
                book=cache.book,
                chapter=cache.chapter,
                verse=BibleCacheSearchService._matching_verse(cache.content, normalized_query),
                snippet=BibleCacheSearchService._snippet(cache.content, normalized_query),
                updated_at=cache.updated_at.isoformat(),
            )
            for cache in BibleCacheSearchService._ordered(queryset, limit)
        ]

    @staticmethod
    def _ordered(
        queryset: QuerySet[BibleContentCache],
        limit: int,
    ) -> QuerySet[BibleContentCache]:
        return queryset.order_by('version', 'book', 'chapter')[:limit]

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
    def _matching_verse(content: str, query: str) -> int | None:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return BibleCacheSearchService._matching_verse_from_text(content, query)

        if isinstance(parsed, dict):
            verses = parsed.get('verses')
            if isinstance(verses, list):
                for verse in verses:
                    if not isinstance(verse, dict):
                        continue
                    verse_text = verse.get('text')
                    verse_number = verse.get('verse')
                    if (
                        isinstance(verse_text, str)
                        and isinstance(verse_number, int)
                        and query.lower() in BibleCacheSearchService._clean_text(verse_text).lower()
                    ):
                        return verse_number
            return None

        return BibleCacheSearchService._matching_verse_from_text(content, query)

    @staticmethod
    def _matching_verse_from_text(content: str, query: str) -> int | None:
        text = BibleCacheSearchService._clean_text(strip_tags(content))
        index = text.lower().find(query.lower())
        if index < 0:
            return None

        matches = list(re.finditer(r'(?:^|\s)(\d{1,3})(?=\s)', text[:index + 1]))
        if not matches:
            return None

        return int(matches[-1].group(1))

    @staticmethod
    def _clean_text(text: str) -> str:
        decoded = unescape(strip_tags(text)).replace('\xa0', ' ')
        without_source_noise = re.sub(r'\s*직접입력\s*\[[^\]]+\]\s*', ' ', decoded)
        return re.sub(r'\s+', ' ', without_source_noise).strip()
