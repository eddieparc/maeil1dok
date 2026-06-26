export interface HasenaPlaylistEntry {
  readonly videoId: string
  readonly videoDate: string
  readonly title: string
  readonly passage: string
  readonly source: 'youtube-feed'
}

export interface HasenaVerse {
  readonly number: string
  readonly text: string
}

export interface HasenaBody {
  readonly passage: string
  readonly verses: readonly HasenaVerse[]
  readonly bodyText: string
}

export interface CachedHasenaEntry {
  readonly date: string
  readonly passage: string
  readonly videoId: string
  readonly title: string
}

export interface HasenaCompletionRecord {
  readonly date: string
  readonly isCompleted: boolean
}

export interface HasenaCalendarEntry extends CachedHasenaEntry {
  readonly isCompleted: boolean
}

const HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'
const HASENA_BODY_BASE_URL = 'https://xn--910b782abhbh7k53rca.kr/bbs/write.php'
const DATE_IN_TITLE_PATTERN = /(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/u
const SCRIPTURE_PATTERN = /\[본문\]\s*([^\n#]+)/u

export function hasenaPlaylistFeedUrl(playlistId = HASENA_PLAYLIST_ID): string {
  return `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`
}

export function hasenaBodyUrl(date: string): string {
  const params = new URLSearchParams({
    bo_table: 'hasena_record',
    targetDate: date,
    forceView: 'true',
  })
  return `${HASENA_BODY_BASE_URL}?${params.toString()}`
}

export function parseHasenaPlaylistFeed(feedXml: string): HasenaPlaylistEntry[] {
  return extractTagBlocks(feedXml, 'entry')
    .map(parsePlaylistEntryBlock)
    .filter((entry): entry is HasenaPlaylistEntry => entry !== null)
}

export function parseHasenaBodyHtml(html: string): HasenaBody {
  const passage = stripHtml(readClassText(html, 'bible_tit')).trim()
  const verses = extractVerseParagraphs(html)
  const bodyText = verses.map((verse) => `${verse.number} ${verse.text}`).join('\n')

  return { passage, verses, bodyText }
}

export function mergeHasenaCalendarEntries(
  entries: readonly CachedHasenaEntry[],
  completions: readonly HasenaCompletionRecord[],
): HasenaCalendarEntry[] {
  const completedDates = completions.filter((record) => record.isCompleted).map((record) => record.date)
  const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]))

  for (const date of completedDates) {
    if (entriesByDate.has(date)) continue
    entriesByDate.set(date, {
      date,
      passage: '',
      videoId: '',
      title: '',
    })
  }

  return Array.from(entriesByDate.values())
    .map((entry) => ({
      ...entry,
      isCompleted: completedDates.includes(entry.date),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
}

function parsePlaylistEntryBlock(block: string): HasenaPlaylistEntry | null {
  const videoId = readTagText(block, 'yt:videoId').trim()
  const rawTitle = readTagText(block, 'title').trim()
  const description = readTagText(block, 'media:description')

  if (!videoId || rawTitle.toLowerCase() === 'private video') {
    return null
  }

  const videoDate = parseKoreanDateFromTitle(rawTitle)
  const passage = parsePassageFromDescription(description)
  if (!videoDate || !passage) {
    return null
  }

  return {
    videoId,
    videoDate,
    title: normalizeKoreanTitle(rawTitle),
    passage,
    source: 'youtube-feed',
  }
}

function parseKoreanDateFromTitle(title: string): string | null {
  const normalized = normalizeKoreanTitle(title)
  const match = DATE_IN_TITLE_PATTERN.exec(normalized)
  if (!match) return null

  const year = match[1]
  const month = match[2].padStart(2, '0')
  const day = match[3].padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parsePassageFromDescription(description: string): string {
  const decoded = decodeXmlEntities(description)
  const match = SCRIPTURE_PATTERN.exec(decoded)
  return match?.[1]?.trim() ?? ''
}

function extractVerseParagraphs(html: string): HasenaVerse[] {
  return extractTagBlocks(readClassBlock(html, 'bible_contents'), 'p')
    .map((paragraph) => {
      const number = stripHtml(readClassText(paragraph, 'bullet_number')).trim()
      const text = stripHtml(readClassText(paragraph, 'bullet_txt')).trim()
      if (!number || !text) return null
      return { number, text }
    })
    .filter((verse): verse is HasenaVerse => verse !== null)
}

function readTagText(source: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'u')
  const match = pattern.exec(source)
  return decodeXmlEntities(match?.[1] ?? '')
}

function extractTagBlocks(source: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gu')
  return Array.from(source.matchAll(pattern), (match) => match[0])
}

function readClassBlock(source: string, className: string): string {
  const pattern = new RegExp(`<([a-z0-9]+)[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'iu')
  const match = pattern.exec(source)
  return match?.[0] ?? ''
}

function readClassText(source: string, className: string): string {
  const block = readClassBlock(source, className)
  return block.replace(/^<[^>]+>/u, '').replace(/<\/[a-z0-9]+>$/iu, '')
}

function stripHtml(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]*>/gu, '').replace(/\s+/gu, ' '))
}

function normalizeKoreanTitle(value: string): string {
  return decodeXmlEntities(value).normalize('NFC')
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_entity, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_entity, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
}
