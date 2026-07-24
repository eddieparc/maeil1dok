import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/hasena/hasenaSync', () => ({
  syncHasenaEntries: vi.fn(),
}))

import { GET } from '@/app/api/cron/hasena-sync/route'
import { syncHasenaEntries } from '@/lib/hasena/hasenaSync'
import type { SyncHasenaResult, SyncedHasenaEntry } from '@/lib/hasena/hasenaSync'

const ORIGINAL_SECRET = process.env.CRON_SECRET
const SECRET = 'cron-secret-under-test'
const BASE_URL = 'http://localhost/api/cron/hasena-sync'

const mockedSync = vi.mocked(syncHasenaEntries)

function cronRequest(url: string = BASE_URL): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${SECRET}` },
  })
}

function entry(date: string): SyncedHasenaEntry {
  return { date, videoId: `vid-${date}`, title: `title ${date}`, passage: '창세기 1장' }
}

function result(
  synced: readonly SyncedHasenaEntry[],
  skipped: readonly string[],
): SyncHasenaResult {
  return { synced, skipped }
}

describe('GET /api/cron/hasena-sync — alertable sync status mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = ORIGINAL_SECRET
    }
  })

  it('returns 200 when the latest attempted entry synced', async () => {
    mockedSync.mockResolvedValue(result([entry('2026-07-11')], []))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('synced')
    expect(body.syncedCount).toBe(1)
    expect(body.skippedCount).toBe(0)
  })

  it('returns 200 when an older date skipped but the newest date synced', async () => {
    mockedSync.mockResolvedValue(result([entry('2026-07-11')], ['2026-07-09']))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('synced')
    expect(body.syncedCount).toBe(1)
    expect(body.skippedCount).toBe(1)
  })

  it('clamps oversized limit to 50 and keeps a valid limit', async () => {
    mockedSync.mockResolvedValue(result([entry('2026-07-11')], []))

    await GET(cronRequest(`${BASE_URL}?limit=200`))
    expect(mockedSync).toHaveBeenCalledWith({ maxEntries: 50 })

    mockedSync.mockClear()
    await GET(cronRequest(`${BASE_URL}?limit=7`))
    expect(mockedSync).toHaveBeenCalledWith({ maxEntries: 7 })
  })

  it('falls back to 14 for invalid, zero, or negative limit', async () => {
    mockedSync.mockResolvedValue(result([entry('2026-07-11')], []))

    for (const raw of ['0', '-5', 'abc', '3.5']) {
      mockedSync.mockClear()
      await GET(cronRequest(`${BASE_URL}?limit=${raw}`))
      expect(mockedSync).toHaveBeenCalledWith({ maxEntries: 14 })
    }
  })

  it('returns 503 hasena_sync_source_empty when no dates were attempted', async () => {
    mockedSync.mockResolvedValue(result([], []))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', reason: 'hasena_sync_source_empty' })
  })

  it('returns 503 hasena_sync_no_entries_cached when every attempted entry skipped', async () => {
    mockedSync.mockResolvedValue(result([], ['2026-07-11', '2026-07-10']))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', reason: 'hasena_sync_no_entries_cached' })
  })

  it('returns 503 hasena_sync_latest_entry_skipped when the newest date was skipped', async () => {
    // Older date synced, newest date skipped.
    mockedSync.mockResolvedValue(result([entry('2026-07-09')], ['2026-07-11']))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', reason: 'hasena_sync_latest_entry_skipped' })
  })

  it('returns 503 hasena_sync_failed without exposing raw error text', async () => {
    mockedSync.mockRejectedValue(new Error('Supabase upsert failed: secret-connection-string'))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', reason: 'hasena_sync_failed' })
    expect(JSON.stringify(body)).not.toContain('secret-connection-string')
    expect(JSON.stringify(body)).not.toContain('Supabase')
  })
})
