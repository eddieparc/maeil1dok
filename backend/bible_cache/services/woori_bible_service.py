import json
import re
from typing import Tuple

import requests

from bible_cache.services.bible_fetch_service_constants import (
    DURANNO_BASE_URL,
    REQUEST_TIMEOUT,
)

WOORI_BOOK_CODE_MAP = {
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


class WooriBibleService:
    @staticmethod
    def fetch(book: str, chapter: int) -> Tuple[str, str, str]:
        book_code = book.lower()
        if book_code not in WOORI_BOOK_CODE_MAP:
            from bible_cache.services.bible_fetch_service import BibleFetchError
            raise BibleFetchError(f"우리말성경에서 지원하지 않는 책: {book}")

        vl = WOORI_BOOK_CODE_MAP[book_code]
        url = f"{DURANNO_BASE_URL}/result_woori.asp"
        response = requests.get(
            url,
            params={'s': 'r', 'kd': '104', 'vl': vl, 'ct': chapter},
            timeout=REQUEST_TIMEOUT,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ko-KR,ko;q=0.9',
            }
        )
        response.raise_for_status()
        response.encoding = 'euc-kr'

        verses = WooriBibleService._parse_html(response.text)
        if not verses:
            from bible_cache.services.bible_fetch_service import BibleFetchError
            raise BibleFetchError(f"우리말성경 본문을 찾을 수 없음: {book} {chapter}장")

        content = json.dumps({
            'version': 'WOORI',
            'book': book,
            'chapter': chapter,
            'verses': verses,
            'found': True,
        }, ensure_ascii=False)
        return content, 'json', f"{url}?s=r&kd=104&vl={vl}&ct={chapter}"

    @staticmethod
    def _parse_html(html_content: str) -> list[dict[str, int | str]]:
        verses: list[dict[str, int | str]] = []
        verse_pattern = re.compile(
            r'>(\d+)\.\s*</td>\s*<td[^>]*>\s*<font[^>]*class\s*=\s*["\']?tk4l["\']?[^>]*>([^<]+)</font>',
            re.IGNORECASE | re.DOTALL
        )

        for match in verse_pattern.finditer(html_content):
            verse_text = match.group(2).strip()
            if verse_text:
                verses.append({'verse': int(match.group(1)), 'text': verse_text})

        if not verses:
            alt_pattern = re.compile(
                r'>(\d+)\.\s*</td>.*?<font[^>]*>([^<]+)</font>',
                re.IGNORECASE | re.DOTALL
            )
            for match in alt_pattern.finditer(html_content):
                verse_text = match.group(2).strip()
                if verse_text and len(verse_text) > 5:
                    verses.append({'verse': int(match.group(1)), 'text': verse_text})

        unique: dict[int, dict[str, int | str]] = {}
        for verse in verses:
            verse_number = verse['verse']
            if isinstance(verse_number, int) and verse_number not in unique:
                unique[verse_number] = verse

        return [unique[key] for key in sorted(unique)]
