// 역본 비교용 병합: 두 역본의 본문 HTML을 절 단위로 나란히 붙인 하나의 HTML로 만든다.
// BibleViewer가 이 HTML을 그대로 렌더하므로 스크롤·선택·하이라이트는 단일 DOM에서 동작한다.
//
// 구조:
//   <div class="verse-pair">            ← 절 하나 = 한 행
//     <div class="pair-primary">…원본 .verse…</div>
//     <div class="pair-secondary">…역본 .verse…</div>
//   </div>
//   <div class="verse-pair pair-heading"><div class="pair-primary">…제목 등…</div></div>
//
// 절이 아닌 블록(소제목 등)은 등장 순서대로 짝지어 한 행에 넣고,
// 한쪽에만 있는 절은 그쪽 셀만 채운다.

const VERSE_START = /<div class="verse[ "]/
const VERSE_NUMBER = /<span class="verse-number">\s*(\d+)/

interface Chunk {
  html: string
  verse: number | null
}

const splitChunks = (html: string): Chunk[] => {
  if (!html) return []
  const marks: number[] = []
  const re = new RegExp(VERSE_START, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) marks.push(m.index)
  if (!marks.length) return [{ html, verse: null }]
  const chunks: Chunk[] = []
  const first = marks[0] ?? 0
  if (first > 0) chunks.push({ html: html.slice(0, first), verse: null })
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i] ?? 0
    const piece = html.slice(start, i + 1 < marks.length ? marks[i + 1] : undefined)
    const num = piece.match(VERSE_NUMBER)
    chunks.push({ html: piece, verse: num?.[1] ? parseInt(num[1], 10) : null })
  }
  return chunks
}

export const mergeCompareContent = (
  primaryHtml: string,
  secondaryHtml: string,
  secondaryRtl = false,
): string => {
  if (!secondaryHtml) return primaryHtml
  const pChunks = splitChunks(primaryHtml)
  const sChunks = splitChunks(secondaryHtml)
  const sVerses = new Map<number, string>()
  const sOthers: string[] = []
  for (const c of sChunks) {
    if (c.verse !== null) sVerses.set(c.verse, c.html)
    else sOthers.push(c.html)
  }
  const secCls = secondaryRtl ? ' rtl-text' : ''
  const cell = (html: string) =>
    `<div class="pair-secondary${secCls}">${html}</div>`

  let sOtherIdx = 0
  const out: string[] = []
  for (const c of pChunks) {
    if (c.verse !== null) {
      out.push(
        `<div class="verse-pair"><div class="pair-primary">${c.html}</div>` +
        cell(sVerses.get(c.verse) ?? '') +
        `</div>`,
      )
    } else {
      // 절이 아닌 블록은 순서대로 짝지어 한 행에 둔다.
      const other = sOtherIdx < sOthers.length ? (sOthers[sOtherIdx++] ?? '') : ''
      out.push(
        `<div class="verse-pair pair-heading"><div class="pair-primary">${c.html}</div>` +
        cell(other) +
        `</div>`,
      )
    }
  }
  return out.join('')
}
