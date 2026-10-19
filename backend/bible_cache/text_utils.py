"""
성경 본문 텍스트 정규화·절 추출 유틸리티

검색(`cache_search_service`)과 캐시 저장(`models.save_to_cache`)이
같은 정규화를 공유하도록 한 곳에 모은다.

- `verse_texts`: 캐시된 원본(HTML 또는 JSON)에서 절 텍스트 목록을 추출한다.
  KNT처럼 JSON 안에 HTML 본문이 중첩된 형태도 지원한다.
- `normalize_for_search`: 검색용 정규화 — NFC, 결합 문자(히브리어 니쿠드,
  그리스어 악센트 등) 제거, 공백 축약. 쿼리와 본문 양쪽에 같은 규칙을 적용해
  발음기호 유무·공백 차이로 인한 미스를 없앤다.
- `search_text_for_content`: 장 전체의 검색 텍스트를 만든다
  (`BibleContentCache.search_text`에 저장되는 값).
"""

import json
import re
import unicodedata
from dataclasses import dataclass
from html import unescape

from django.utils.html import strip_tags


@dataclass(frozen=True, slots=True)
class VerseSearchHit:
    verse: int | None
    text: str


_SCRIPT_STYLE_RE = re.compile(
    r'<(script|style)\b[^>]*>[\s\S]*?</\1\s*>', re.IGNORECASE
)


def _drop_script_style(text: str) -> str:
    """<script>/<style> 블록을 통째로 제거한다 (strip_tags는 내용을 남긴다)."""
    return _SCRIPT_STYLE_RE.sub(' ', text)


def clean_text(text: str) -> str:
    """HTML 태그·엔티티·소스 노이즈를 제거하고 공백을 정리한다."""
    decoded = unescape(strip_tags(_drop_script_style(text))).replace('\xa0', ' ')
    without_source_noise = re.sub(r'\s*직접입력\s*\[[^\]]+\]\s*', ' ', decoded)
    return re.sub(r'\s+', ' ', without_source_noise).strip()


def normalize_for_search(text: str) -> str:
    """검색 비교용 정규화: NFC → 결합 문자 제거 → 공백 축약 → 소문자."""
    # NFD로 분해해야 precomposed 문자(ό 등)의 결합 문자가 드러난다
    decomposed = unicodedata.normalize('NFD', text)
    stripped = ''.join(
        char for char in decomposed if not unicodedata.combining(char)
    )
    # NFC로 재조합(한글 자모→음절) 후 casefold(ς→σ 등)로 통일
    recomposed = unicodedata.normalize('NFC', stripped)
    return re.sub(r'\s+', ' ', recomposed).strip().casefold()


def search_text_for_content(content: str) -> str:
    """캐시 원본에서 검색용 평문을 만든다 (search_text 컬럼 값)."""
    verses = verse_texts(content)
    if verses:
        joined = ' '.join(hit.text for hit in verses if hit.text)
        if joined:
            return normalize_for_search(joined)
    return normalize_for_search(clean_text(content))


def verse_texts(content: str) -> list[VerseSearchHit]:
    """캐시 원본에서 (절 번호, 정제된 텍스트) 목록을 추출한다."""
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return _verse_texts_from_html(content)

    if isinstance(parsed, dict):
        verses = parsed.get('verses')
        if isinstance(verses, list):
            hits: list[VerseSearchHit] = []
            for verse in verses:
                if not isinstance(verse, dict):
                    continue
                verse_text = verse.get('text')
                verse_number = verse.get('verse')
                if isinstance(verse_text, str):
                    hits.append(
                        VerseSearchHit(
                            verse=verse_number if isinstance(verse_number, int) else None,
                            text=clean_text(verse_text),
                        )
                    )
            return hits

        # KNT 등: JSON 안에 HTML 본문이 중첩된 형태
        inner = parsed.get('content')
        if isinstance(inner, str) and '<' in inner:
            return _verse_texts_from_html(inner)

    if isinstance(parsed, list):
        text = clean_text(' '.join(str(item) for item in parsed))
        return [VerseSearchHit(verse=None, text=text)] if text else []

    text = clean_text(strip_tags(content))
    return [VerseSearchHit(verse=None, text=text)] if text else []


def _verse_texts_from_html(content: str) -> list[VerseSearchHit]:
    # API.Bible 형식: <span data-number="N" ...>N</span>본문
    # 한 절이 여러 <p>에 걸칠 수 있으므로 다음 절 번호(또는 문서 끝)까지가
    # 절 본문이다. <p>에서 끊으면 둘째 문단 이후가 유실된다.
    api_bible_verses = [
        VerseSearchHit(
            verse=int(match.group(1)),
            text=clean_text(match.group(2)),
        )
        for match in re.finditer(
            r'<span\b[^>]*data-number=["\'](\d+)["\'][^>]*>[^<]*</span>([\s\S]*?)(?=<span\b[^>]*data-number=|$)',
            content,
            re.IGNORECASE,
        )
    ]
    if api_bible_verses:
        return api_bible_verses

    # 절 끝: </span> 뒤 <br/>가 일반적이지만 마지막 절은 </div>나 문서 끝으로
    # 닫힌다. 종결을 넓히지 않으면 마지막 절이 페이지 크롬까지 삼킨다.
    # 절 번호는 '2-3' 같은 범위일 수 있다 — 첫 숫자를 절 번호로 쓴다.
    verses = [
        VerseSearchHit(
            verse=int(match.group(1)),
            text=clean_text(match.group(2)),
        )
        for match in re.finditer(
            r'<span\b[^>]*>\s*<span\b[^>]*class=["\']number["\'][^>]*>\s*(\d{1,3})(?:-\d{1,3})?(?:&nbsp;|\s)*</span>([\s\S]*?)</span>\s*(?:<br\s*/?>|</div|$)',
            content,
            re.IGNORECASE,
        )
    ]
    if verses:
        return verses

    simple_span_verses = [
        VerseSearchHit(
            verse=int(match.group(1)),
            text=clean_text(match.group(2)),
        )
        for match in re.finditer(
            r'<span\b[^>]*>\s*(\d{1,3})(?:-\d{1,3})?(?:&nbsp;|\s)+([\s\S]*?)</span>',
            content,
            re.IGNORECASE,
        )
    ]
    if simple_span_verses:
        return simple_span_verses

    text = clean_text(strip_tags(content))
    return [VerseSearchHit(verse=None, text=text)] if text else []


def plain_text(content: str) -> str:
    """스니펫용 평문 (기존 _plain_text 동작 유지, 중첩 JSON 지원)."""
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return strip_tags(_drop_script_style(content))

    if not isinstance(parsed, dict):
        return strip_tags(_drop_script_style(content))

    verses = parsed.get('verses')
    if isinstance(verses, list):
        return ' '.join(
            verse.get('text', '')
            for verse in verses
            if isinstance(verse, dict) and isinstance(verse.get('text'), str)
        )

    inner = parsed.get('content')
    if isinstance(inner, str):
        return strip_tags(_drop_script_style(inner))

    return strip_tags(_drop_script_style(content))


def find_normalized_index(text: str, normalized_query: str) -> int:
    """원문 text에서 normalized_query가 매칭되는 원문 인덱스를 반환한다.

    정규화(결합 문자 제거·공백 축약·소문자)를 적용한 위치를 원문 인덱스로
    되돌린다. 매칭이 없으면 -1.
    """
    if not normalized_query:
        return -1

    # 원문 각 문자가 정규화 결과의 몇 번째 문자에 대응하는지 계산
    norm_chars: list[str] = []
    orig_index: list[int] = []  # norm_chars[i]를 만든 원문 인덱스
    prev_was_space = True
    for i, char in enumerate(text):
        for sub in unicodedata.normalize('NFD', char):
            if unicodedata.combining(sub):
                continue
            lowered = unicodedata.normalize('NFC', sub).casefold()
            if lowered.isspace():
                if prev_was_space:
                    continue
                norm_chars.append(' ')
                orig_index.append(i)
                prev_was_space = True
            else:
                # casefold는 1문자→여러 문자(ß→ss)가 될 수 있어 문자 단위로 펼친다
                for folded in lowered:
                    norm_chars.append(folded)
                    orig_index.append(i)
                prev_was_space = False
    if norm_chars and norm_chars[-1] == ' ':
        norm_chars.pop()
        orig_index.pop()

    normalized = ''.join(norm_chars)
    pos = normalized.find(normalized_query)
    if pos < 0:
        return -1
    return orig_index[pos]
