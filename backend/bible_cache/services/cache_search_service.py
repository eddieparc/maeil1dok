import json
import re
from dataclasses import dataclass

from django.db.models import QuerySet
from django.utils.html import strip_tags

from bible_cache.models import BibleContentCache


@dataclass(frozen=True, slots=True)
class BibleCacheSearchResult:
    version: str
    book: str
    chapter: int
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
        normalized = re.sub(r'\s+', ' ', text).strip()
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
