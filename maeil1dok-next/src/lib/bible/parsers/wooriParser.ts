import { NO_CONTENT_HTML, type ParseResult } from '@/lib/bible/parsers/common'

interface WooriVerse {
  verse: number
  text: string
}

interface WooriPayload {
  found?: boolean
  verses?: WooriVerse[]
}

export function parseWooriContent(payload: unknown): ParseResult {
  const data = payload as WooriPayload

  if (!data || typeof data !== 'object' || !Array.isArray(data.verses) || data.verses.length === 0) {
    return { html: NO_CONTENT_HTML, error: 'Invalid WOORI payload' }
  }

  const html = data.verses
    .filter((verse) => typeof verse?.verse === 'number' && typeof verse?.text === 'string' && verse.text.trim())
    .map(
      (verse) =>
        `<div class="verse"><span class="verse-number">${verse.verse}</span><span class="verse-text">${verse.text}</span></div>`
    )
    .join('')

  if (!html) {
    return { html: NO_CONTENT_HTML, error: 'WOORI payload has no readable verses' }
  }

  return { html }
}
