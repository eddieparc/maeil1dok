"""장별 성경읽기 오디오 폴백 원천.

플랜 일정(`DailyBibleSchedule`)에 `audio_link` 가 비어 있을 때, 유튜브
@readingjesus 채널의 "<책이름> - 장별 성경읽기" 재생목록 영상을 각 장의
기본 오디오로 쓴다. 매핑 데이터는 `todos/data/chapter_audio_sources.json`
이 단일 원천이다.
"""

import json
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "chapter_audio_sources.json"

WATCH_URL_TEMPLATE = "https://www.youtube.com/watch?v={video_id}"


@lru_cache(maxsize=1)
def load_chapter_audio_sources():
    """책 코드 -> {장 번호: video_id} 매핑을 돌려준다.

    데이터 파일이 없거나 깨졌으면 그대로 예외를 올린다. 조용히 비어 있는
    매핑으로 축소하면 폴백이 사라진 것을 아무도 눈치채지 못한다.
    """
    with DATA_PATH.open(encoding="utf-8") as fp:
        payload = json.load(fp)

    sources = {}
    for book_code, entry in payload["books"].items():
        sources[book_code] = {
            int(chapter): video_id for chapter, video_id in entry["chapters"].items()
        }
    return sources


def get_chapter_audio_url(book_code, chapter):
    """해당 책·장의 유튜브 시청 URL. 매핑에 없으면 None."""
    video_id = load_chapter_audio_sources().get(book_code, {}).get(chapter)
    if not video_id:
        return None
    return WATCH_URL_TEMPLATE.format(video_id=video_id)


def build_fallback_audio_links(ranges):
    """(책 코드, 시작 장, 끝 장) 목록을 장별 폴백 오디오 항목으로 펼친다.

    매핑에 없는 장은 항목을 만들지 않는다.
    """
    links = []
    for book_code, start_chapter, end_chapter in ranges:
        for chapter in range(start_chapter, end_chapter + 1):
            url = get_chapter_audio_url(book_code, chapter)
            if url:
                links.append({"book": book_code, "chapter": chapter, "url": url})
    return links
