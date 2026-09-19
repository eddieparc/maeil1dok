/**
 * bibleContent — 성경 본문 파서 (순수 모듈, test target).
 *
 * GET /api/v1/bible-cache/{version}/{book}/{chapter}/ 응답의 data.content 를
 * 렌더링 가능한 블록 목록으로 변환한다. 두 가지 마크업을 다룬다:
 *
 * - content_type 'html': 대한성서공회 korbibReadpage 마크업
 *   (GAE/SAENEW/HAN/SAE/COG/COGNEW). 절은 `<span class="number">N&nbsp;</span>`
 *   마커로 시작하고, 각주는 절 안에 중첩된 `<a class=comment>` 와
 *   `<div class=D2>` 팝업으로 들어온다.
 * - content_type 'json': 새한글성경(KNT) USX 스타일 마크업. content 가
 *   `{"found":true,"content":"<h2 .../>...</p>"}` JSON 문자열이다.
 *
 * DOM 이 없는 React Native 환경에서 동작하도록 정규식/스캐너 기반이다.
 * 프론트엔드 참조 구현: frontend/app/composables/bible/useBibleContent.ts
 */

export type BibleBlock =
  | { readonly type: 'verse'; readonly num: number; readonly text: string }
  | { readonly type: 'heading'; readonly text: string }
  | { readonly type: 'note'; readonly text: string };

export interface BibleVersion {
  readonly code: string;
  readonly name: string;
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : '';
    });

const stripTags = (html: string): string => html.replace(/<[^>]*>/g, ' ');

/** 태그 제거 + 엔티티 디코딩 + 공백 정규화. */
const cleanText = (html: string): string =>
  decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();

/**
 * `fromIndex` 위치의 여는 태그(`<tag ...>`)부터 대응하는 닫는 태그까지의
 * 범위를 반환한다. 같은 태그의 중첩을 depth 로 추적한다.
 * 닫는 태그를 못 찾으면 여는 태그만 범위로 잡는다.
 */
const elementRange = (
  html: string,
  fromIndex: number,
  tag: string,
): { start: number; end: number } => {
  const pattern = new RegExp(`<\\/?${tag}(?:\\s[^>]*)?>`, 'gi');
  pattern.lastIndex = fromIndex;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const token = match[0];
    const isClose = token.startsWith('</');
    const isSelfClose = token.endsWith('/>');
    if (!isClose && !isSelfClose) {
      depth += 1;
    } else if (isClose) {
      depth -= 1;
      if (depth <= 0) {
        return { start: fromIndex, end: match.index + token.length };
      }
    }
  }
  // 닫는 태그 없음(잘린 문서): 문서 끝까지를 범위로 본다
  return { start: fromIndex, end: html.length };
};

/** `tag` 요소를 통째로 제거한다 (중첩 포함). */
const removeElements = (html: string, tag: string, attrFilter?: RegExp): string => {
  const openPattern = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'gi');
  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(html)) !== null) {
    if (attrFilter && !attrFilter.test(match[0])) continue;
    const range = elementRange(html, match.index, tag);
    result += html.slice(cursor, match.index);
    cursor = range.end;
    openPattern.lastIndex = range.end;
  }
  return result + html.slice(cursor);
};

// ---------------------------------------------------------------------------
// html content_type — 대한성서공회 마크업
// ---------------------------------------------------------------------------

const HEADING_RE = /<font\s+class="smallTitle"[^>]*>/gi;
const VERSE_NUM_RE = /<span\s+class="number"[^>]*>\s*(\d+)/gi;
// attrFilter 용 패턴: .test() 전용이라 g 플래그를 쓰지 않는다
// (g 가 있으면 lastIndex 가 호출 사이에 남아 교대로 실패한다).
const FOOTNOTE_DIV_RE = /<div\s+id='D_\d+_\d+'\s+class=D2\b/i;
const COMMENT_ANCHOR_RE = /<a\s+class=comment\b/i;

const parseStandardHtml = (html: string): BibleBlock[] => {
  // 본문 컨테이너로 범위를 좁힌다. 없으면 문서 전체를 스캔한다.
  let scope = html;
  const containerMatch = /<div\s+id="tdBible1"[^>]*>/i.exec(html);
  if (containerMatch) {
    const range = elementRange(html, containerMatch.index, 'div');
    scope = html.slice(containerMatch.index + containerMatch[0].length, range.end);
  }

  const blocks: BibleBlock[] = [];
  const seen = new Set<number>();
  const tokenRe = new RegExp(
    `${HEADING_RE.source}|${VERSE_NUM_RE.source}`,
    'gi',
  );
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(scope)) !== null) {
    if (match[1] === undefined) {
      // smallTitle 소제목 (캡처 그룹 없음 — 절 번호 그룹이 비어 있다)
      const close = scope.indexOf('</font>', match.index);
      if (close === -1) continue;
      const text = cleanText(scope.slice(match.index + match[0].length, close));
      if (text) blocks.push({ type: 'heading', text });
      tokenRe.lastIndex = close + '</font>'.length;
      continue;
    }

    const num = parseInt(match[1], 10);
    if (seen.has(num)) continue;
    seen.add(num);

    // 절 본문: 번호 마커의 </span> 이후부터 다음 토큰(소제목/다음 절)까지
    const numSpanClose = scope.indexOf('</span>', match.index);
    const bodyStart = numSpanClose === -1 ? match.index + match[0].length : numSpanClose + '</span>'.length;
    const nextToken = tokenRe.exec(scope);
    const bodyEnd = nextToken ? nextToken.index : scope.length;
    if (nextToken) tokenRe.lastIndex = nextToken.index;

    let body = scope.slice(bodyStart, bodyEnd);
    // 각주 팝업 div (절 span 안에 중첩돼 들어옴) 통째로 제거
    body = removeElements(body, 'div', FOOTNOTE_DIV_RE);
    // 각주 앵커 (<a class=comment>…</a>) 통째로 제거
    body = removeElements(body, 'a', COMMENT_ANCHOR_RE);
    const text = cleanText(body);
    if (text) blocks.push({ type: 'verse', num, text });
  }
  return blocks;
};

// ---------------------------------------------------------------------------
// json content_type — KNT(새한글성경) USX 스타일 마크업
// ---------------------------------------------------------------------------

const KNT_FOOTNOTE_RE = /<span\s[^>]*class="f"[^>]*>/i;
const KNT_VERSE_MARKER_RE = /<span\s[^>]*class="v"[^>]*>/i;

const stripKntFootnotes = (html: string): string =>
  removeElements(html, 'span', KNT_FOOTNOTE_RE);

/** 각주 + 절 번호 마커를 제거한 뒤 텍스트만 남긴다 (제목/주석용). */
const cleanKntInline = (html: string): string =>
  cleanText(removeElements(stripKntFootnotes(html), 'span', KNT_VERSE_MARKER_RE));

const parseKntJson = (raw: string): BibleBlock[] => {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(envelope) || envelope.found !== true || typeof envelope.content !== 'string') {
    return [];
  }
  const html = envelope.content;
  const blocks: BibleBlock[] = [];

  // 최상위 <h2>/<p> 요소 순회
  const elementRe = /<(h2|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  let currentNum: number | null = null;
  let currentLines: string[] = [];
  const seen = new Set<number>();

  const flush = () => {
    if (currentNum === null) return;
    const text = currentLines.join('\n').trim();
    if (text) blocks.push({ type: 'verse', num: currentNum, text });
    currentNum = null;
    currentLines = [];
  };

  const startVerse = (num: number) => {
    if (currentNum === num) return;
    flush();
    if (seen.has(num)) return; // 중복 절 번호는 텍스트만 버린다
    seen.add(num);
    currentNum = num;
    currentLines = [];
  };

  const appendLine = (htmlFragment: string) => {
    const text = cleanText(stripKntFootnotes(htmlFragment));
    if (text && currentNum !== null) currentLines.push(text);
  };

  while ((match = elementRe.exec(html)) !== null) {
    const [, tag, attrs, inner] = match;
    const classMatch = /class="([^"]*)"/.exec(attrs);
    const cls = classMatch ? classMatch[1] : '';

    if (tag === 'h2') continue; // 장 번호 표시 — 화면이 자체 라벨을 쓴다

    if (cls === 's' || cls === 'sp') {
      flush();
      const text = cleanKntInline(inner);
      if (text) blocks.push({ type: 'heading', text });
      continue;
    }
    if (cls === 'd' || cls === 'r') {
      flush();
      const text = cleanKntInline(inner);
      if (text) blocks.push({ type: 'note', text });
      continue;
    }

    // 절 본문 단락 (p, q1, m, nb, …)
    const vidMatch = /data-vid="[^"]*?:(\d+)"/.exec(attrs);
    const markerRe = /<span\s[^>]*class="v"[^>]*>\s*(\d+)\s*<\/span>/gi;
    const markers: { num: number; index: number; length: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = markerRe.exec(inner)) !== null) {
      markers.push({ num: parseInt(m[1], 10), index: m.index, length: m[0].length });
    }

    if (markers.length === 0) {
      // 절 마커 없음: data-vid 또는 verse-span 의 data-verse-id 로 귀속
      let num = vidMatch ? parseInt(vidMatch[1], 10) : null;
      if (num === null) {
        const orgMatch = /data-verse-(?:id|org-ids)="[^"]*\.(\d+)"/.exec(inner);
        if (orgMatch) num = parseInt(orgMatch[1], 10);
      }
      if (num !== null) {
        startVerse(num);
        appendLine(inner);
      } else {
        const plain = cleanText(stripKntFootnotes(inner));
        if (plain) appendLine(inner); // 마커도 id 도 없는 텍스트는 이전 절에 연결
      }
      continue;
    }

    // 마커 앞 텍스트(드묾)는 이전 절에 연결
    if (markers[0].index > 0) appendLine(inner.slice(0, markers[0].index));

    for (let i = 0; i < markers.length; i += 1) {
      const segStart = markers[i].index + markers[i].length;
      const segEnd = i + 1 < markers.length ? markers[i + 1].index : inner.length;
      startVerse(markers[i].num);
      appendLine(inner.slice(segStart, segEnd));
    }
  }
  flush();
  return blocks;
};

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * bible-cache 본문을 블록 목록으로 파싱한다.
 * 알 수 없는/깨진 입력은 빈 배열을 반환한다 (화면에서 에러 상태로 처리).
 */
export const parseBibleContent = (
  content: unknown,
  contentType: unknown,
): BibleBlock[] => {
  if (typeof content !== 'string' || content.trim() === '') return [];
  try {
    if (contentType === 'json') return parseKntJson(content);
    if (contentType === 'html') return parseStandardHtml(content);
    return [];
  } catch {
    return [];
  }
};

/**
 * GET /api/v1/bible-cache/versions/ 응답을 {code, name} 목록으로 정규화한다.
 * `{versions:[...]}` 와 bare 배열 둘 다 받고, 잘못된 항목은 버리고 code 기준
 * 중복을 제거한다.
 */
export const normalizeVersionList = (json: unknown): BibleVersion[] => {
  const list = Array.isArray(json)
    ? json
    : isRecord(json) && Array.isArray(json.versions)
      ? json.versions
      : null;
  if (!list) return [];

  const seen = new Set<string>();
  const versions: BibleVersion[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const { code, name } = item;
    if (typeof code !== 'string' || code.trim() === '') continue;
    if (typeof name !== 'string' || name.trim() === '') continue;
    if (seen.has(code)) continue;
    seen.add(code);
    versions.push({ code, name });
  }
  return versions;
};
