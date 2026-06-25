import type { Json } from '@/lib/supabase/database.types'
import {
  hasenaBodyUrl,
  hasenaPlaylistFeedUrl,
  parseHasenaBodyHtml,
  parseHasenaPlaylistFeed,
  type HasenaPlaylistEntry,
  type HasenaVerse,
} from './hasenaSources'

export interface SyncHasenaOptions {
  readonly maxEntries: number
  readonly fetchImpl?: typeof fetch
}

export interface SyncedHasenaEntry {
  readonly date: string
  readonly videoId: string
  readonly title: string
  readonly passage: string
}

export interface SyncHasenaResult {
  readonly synced: readonly SyncedHasenaEntry[]
  readonly skipped: readonly string[]
}

const DEFAULT_MAX_ENTRIES = 14

export async function syncHasenaEntries(
  options: SyncHasenaOptions = { maxEntries: DEFAULT_MAX_ENTRIES },
): Promise<SyncHasenaResult> {
  const request = options.fetchImpl ?? fetch
  const feedResponse = await request(hasenaPlaylistFeedUrl(), {
    headers: { 'User-Agent': 'Maeil1Dok/1.0 (+https://maeil1dok.app)' },
  })

  if (!feedResponse.ok) {
    throw new Error(`Hasena playlist feed failed: ${feedResponse.status}`)
  }

  const feedText = await feedResponse.text()
  const playlistEntries = parseHasenaPlaylistFeed(feedText).slice(0, options.maxEntries)
  const synced: SyncedHasenaEntry[] = []
  const skipped: string[] = []

  for (const playlistEntry of playlistEntries) {
    const result = await syncOneHasenaEntry(request, playlistEntry)
    if (result) {
      synced.push(result)
    } else {
      skipped.push(playlistEntry.videoDate)
    }
  }

  return { synced, skipped }
}

async function syncOneHasenaEntry(
  request: typeof fetch,
  playlistEntry: HasenaPlaylistEntry,
): Promise<SyncedHasenaEntry | null> {
  const bodyUrl = hasenaBodyUrl(playlistEntry.videoDate)
  const bodyResponse = await request(bodyUrl, {
    headers: { 'User-Agent': 'Maeil1Dok/1.0 (+https://maeil1dok.app)' },
  })

  if (!bodyResponse.ok) return null

  const body = parseHasenaBodyHtml(await bodyResponse.text())
  if (!body.passage || body.verses.length === 0) return null

  const passage = body.passage || playlistEntry.passage
  await upsertCachedEntry(request, {
    date: playlistEntry.videoDate,
    video_id: playlistEntry.videoId,
    title: playlistEntry.title,
    passage,
    body_text: body.bodyText,
    verses: toJsonVerses(body.verses),
    source_url: `https://www.youtube.com/watch?v=${playlistEntry.videoId}`,
    body_source_url: bodyUrl,
    fetched_at: new Date().toISOString(),
  })

  return {
    date: playlistEntry.videoDate,
    videoId: playlistEntry.videoId,
    title: playlistEntry.title,
    passage,
  }
}

interface HasenaEntryUpsertRow {
  readonly date: string
  readonly video_id: string
  readonly title: string
  readonly passage: string
  readonly body_text: string
  readonly verses: Json
  readonly source_url: string
  readonly body_source_url: string
  readonly fetched_at: string
}

async function upsertCachedEntry(request: typeof fetch, row: HasenaEntryUpsertRow): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service credentials are not configured')
  }

  const response = await request(`${supabaseUrl}/rest/v1/hasena_entries?on_conflict=date`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  })

  if (!response.ok) {
    throw new Error(`Hasena entry upsert failed: ${response.status}`)
  }
}

function toJsonVerses(verses: readonly HasenaVerse[]): Json {
  return verses.map((verse) => ({ number: verse.number, text: verse.text }))
}
