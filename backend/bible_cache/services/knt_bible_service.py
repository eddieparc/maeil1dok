from typing import Tuple

import requests

from bible_cache.services.bible_fetch_service_constants import (
    BSKOREA_BASE_URL,
    REQUEST_TIMEOUT,
)

KNT_BOOK_CODE_MAP = {
    'jnh': 'JON',
}


class KntBibleService:
    @staticmethod
    def fetch(book: str, chapter: int) -> Tuple[str, str, str]:
        knt_book = KNT_BOOK_CODE_MAP.get(book.lower(), book.upper())
        url = f"{BSKOREA_BASE_URL}/KNT/get_chapter.php"
        params = {
            'version': 'd7a4326402395391-01',
            'chapter': f"{knt_book}.{chapter}"
        }

        response = requests.get(
            url,
            params=params,
            timeout=REQUEST_TIMEOUT,
            headers={
                'User-Agent': 'Maeil1Dok/1.0',
                'Accept': 'application/json',
            }
        )
        response.raise_for_status()

        json_data = response.json()
        if not json_data.get('found'):
            from bible_cache.services.bible_fetch_service import BibleFetchError

            raise BibleFetchError(f"KNT 본문을 찾을 수 없음: {knt_book}.{chapter}")

        source_url = f"{url}?version=d7a4326402395391-01&chapter={knt_book}.{chapter}"
        return response.text, 'json', source_url
