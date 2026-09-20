/**
 * 하세나 본문 절 렌더링 (pages/hasena.vue에서 추출, LAB-146 WP-10).
 *
 * escapeHtml은 useSanitize.ts / utils/hasenaFormatters.js와 동일 구현이다
 * (dup-scan P1-7). utils/hasenaFormatters.js는 이 WP의 소유 범위 밖이라
 * canonical 합류는 WP-99 sweep에 맡긴다.
 */

export interface HasenaVerseLike {
  number?: string
  verse?: number
  text?: string
}

export const escapeHtml = (value: unknown): string => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const renderHasenaVerses = (verses: HasenaVerseLike[]): string => {
  return verses.map((verse) => `
    <div class="hasena-verse">
      <span class="hasena-verse-number">${escapeHtml(verse.number || '')}</span>
      <span class="hasena-verse-text">${escapeHtml(verse.text || '')}</span>
    </div>
  `).join('')
}
