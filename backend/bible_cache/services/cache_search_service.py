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


@dataclass(frozen=True, slots=True)
class BibleCacheVerseSearchHit:
    verse: int | None
    text: str


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
            if len(results) >= limit:
                break

        return results

    @staticmethod
    def _ordered(
        queryset: QuerySet[BibleContentCache],
    ) -> QuerySet[BibleContentCache]:
        return queryset.order_by('version', 'book', 'chapter')

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

        text = BibleCacheSearchService._clean_text(strip_tags(content))
        return [BibleCacheVerseSearchHit(verse=None, text=text)] if text else []

    @staticmethod
    def _clean_text(text: str) -> str:
        decoded = unescape(strip_tags(text)).replace('\xa0', ' ')
        without_source_noise = re.sub(r'\s*직접입력\s*\[[^\]]+\]\s*', ' ', decoded)
        return re.sub(r'\s+', ' ', without_source_noise).strip()
