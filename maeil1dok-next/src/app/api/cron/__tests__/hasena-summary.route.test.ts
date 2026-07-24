import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/firebase/send', () => ({
  sendMulticastNotification: vi.fn(),
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(),
}))

import { GET } from '@/app/api/cron/hasena-summary/route'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendMulticastNotification } from '@/lib/firebase/send'
import { GoogleGenerativeAI } from '@google/generative-ai'

const ORIGINAL_SECRET = process.env.CRON_SECRET
const ORIGINAL_GEMINI = process.env.GEMINI_API_KEY
const ORIGINAL_PLAYLIST = process.env.HASENA_PLAYLIST_ID
const ORIGINAL_YOUTUBE = process.env.YOUTUBE_API_KEY

const SECRET = 'cron-secret-under-test'
const URL = 'http://localhost/api/cron/hasena-summary'

// Midday UTC keeps the weekday stable across the test runner's local timezone
// (the route derives Sunday from local `getDay()`).
const MONDAY = '2026-07-13T12:00:00Z'
const SUNDAY = '2026-07-12T12:00:00Z'

function cronRequest(): NextRequest {
  return new NextRequest(URL, {
    method: 'GET',
    headers: { authorization: `Bearer ${SECRET}` },
  })
}

/** Await enough microtask turns for the fire-and-forget notification fanout. */
async function flushMicrotasks(turns = 15) {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve()
  }
}

/**
 * A thenable Supabase query-builder stub. Every chain method returns `this`, and
 * awaiting the builder resolves to the configured `{ data, error }` result.
 */
function queryResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.gte = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.in = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.insert = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: result.data ?? null, error: result.error ?? null })
  return builder
}

/**
 * Build a service-role client stub. `hasena_summaries` is consulted three times
 * in order (today idempotency read, video_id idempotency read, insert); each is
 * routed to its own builder. `notification_settings`/`fcm_tokens` back the
 * best-effort notification fanout.
 */
function serviceClient(config: {
  todayCheck?: { data?: unknown; error?: unknown }
  videoCheck?: { data?: unknown; error?: unknown }
  insert?: { data?: unknown; error?: unknown }
  settings?: { data?: unknown; error?: unknown }
  tokens?: { data?: unknown; error?: unknown }
}) {
  const summariesBuilders = [
    queryResult(config.todayCheck ?? { data: [] }),
    queryResult(config.videoCheck ?? { data: [] }),
    queryResult(config.insert ?? { data: null }),
  ]
  let summariesIdx = 0
  const settingsBuilder = queryResult(config.settings ?? { data: [] })
  const fcmSelectBuilder = queryResult(config.tokens ?? { data: [] })
  const fcmDeleteBuilder = queryResult({ data: null })
  let fcmCall = 0
  const from = vi.fn((table: string) => {
    if (table === 'hasena_summaries') {
      return summariesBuilders[Math.min(summariesIdx++, summariesBuilders.length - 1)]
    }
    if (table === 'notification_settings') return settingsBuilder
    if (table === 'fcm_tokens') {
      fcmCall += 1
      return fcmCall === 1 ? fcmSelectBuilder : fcmDeleteBuilder
    }
    throw new Error(`unexpected table ${table}`)
  })
  return {
    client: { from },
    from,
    summariesBuilders,
    settingsBuilder,
    fcmSelectBuilder,
    fcmDeleteBuilder,
  }
}

function mockGemini(generateContent: () => Promise<unknown>) {
  // Must be a constructable (non-arrow) function: the route calls
  // `new GoogleGenerativeAI(...)`, and arrow-function mock implementations
  // throw "is not a constructor".
  vi.mocked(GoogleGenerativeAI).mockImplementation(function () {
    return {
      getGenerativeModel: vi.fn(() => ({ generateContent })),
    }
  } as never)
}

function ytOk(items: unknown[]) {
  return { ok: true, json: async () => ({ items }) }
}

function ytItem(videoId: string, title: string) {
  return { snippet: { resourceId: { videoId }, title } }
}

let fetchMock: ReturnType<typeof vi.fn>

describe('hasena-summary cron route — authorized behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(MONDAY))
    process.env.CRON_SECRET = SECRET
    process.env.GEMINI_API_KEY = 'gemini-key'
    process.env.HASENA_PLAYLIST_ID = 'PL_secret_playlist'
    process.env.YOUTUBE_API_KEY = 'youtube-key'

    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    // Default: Gemini succeeds. Individual tests override as needed.
    mockGemini(async () => ({ response: { text: () => '오늘의 요약 본문' } }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    restoreEnv('CRON_SECRET', ORIGINAL_SECRET)
    restoreEnv('GEMINI_API_KEY', ORIGINAL_GEMINI)
    restoreEnv('HASENA_PLAYLIST_ID', ORIGINAL_PLAYLIST)
    restoreEnv('YOUTUBE_API_KEY', ORIGINAL_YOUTUBE)
  })

  function restoreEnv(key: string, original: string | undefined) {
    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
  }

  it('1. returns 200 on Sunday and creates no Supabase service client', async () => {
    vi.setSystemTime(new Date(SUNDAY))

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'skipped', reason: 'sunday' })
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('2. returns 503 configuration_unavailable when service credentials are missing', async () => {
    vi.mocked(createServiceRoleClient).mockImplementation(() => {
      throw new Error('Supabase service credentials are not configured')
    })

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'configuration_unavailable' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(GoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it('3. returns 503 with a sanitized body when a required cron env var is missing', async () => {
    delete process.env.GEMINI_API_KEY
    const { client } = serviceClient({})
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'configuration_unavailable' })
    // Config failure happens before any external call.
    expect(fetchMock).not.toHaveBeenCalled()
    expect(GoogleGenerativeAI).not.toHaveBeenCalled()
    // Never leak the playlist id or keys.
    expect(JSON.stringify(body)).not.toContain('PL_secret_playlist')
    expect(JSON.stringify(body)).not.toContain('gemini-key')
  })

  it('4. returns 200 already_generated when a summary already exists today', async () => {
    const { client } = serviceClient({ todayCheck: { data: [{ id: 1 }] } })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'skipped', reason: 'already_generated' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('5. returns 200 video_already_processed when the latest video was seen', async () => {
    fetchMock.mockResolvedValue(ytOk([ytItem('vid123', '하세나 제목')]))
    const { client } = serviceClient({ videoCheck: { data: [{ id: 7 }] } })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'skipped', reason: 'video_already_processed' })
    expect(GoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it('6a. returns 503 when the today idempotency read errors', async () => {
    const { client } = serviceClient({ todayCheck: { error: { message: 'db boom' } } })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'data_access_unavailable' })
    expect(JSON.stringify(body)).not.toContain('db boom')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('6b. returns 503 when the video_id idempotency read errors', async () => {
    fetchMock.mockResolvedValue(ytOk([ytItem('vid123', '하세나 제목')]))
    const { client } = serviceClient({ videoCheck: { error: { message: 'db boom' } } })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'data_access_unavailable' })
    expect(GoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it('7a. returns 503 when the YouTube API responds non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    const { client } = serviceClient({})
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'upstream_unavailable' })
    expect(GoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it('7b. returns 503 when the YouTube playlist response is empty', async () => {
    fetchMock.mockResolvedValue(ytOk([]))
    const { client } = serviceClient({})
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'upstream_unavailable' })
    expect(GoogleGenerativeAI).not.toHaveBeenCalled()
  })

  it('8. returns 503 generation_unavailable when Gemini generation fails', async () => {
    fetchMock.mockResolvedValue(ytOk([ytItem('vid123', '하세나 제목')]))
    const { client } = serviceClient({})
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    mockGemini(async () => {
      throw new Error('gemini upstream failure')
    })

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'generation_unavailable' })
    expect(JSON.stringify(body)).not.toContain('gemini upstream failure')
  })

  it('9. returns 503 without exposing the raw database message on insert error', async () => {
    fetchMock.mockResolvedValue(ytOk([ytItem('vid123', '하세나 제목')]))
    const { client } = serviceClient({
      insert: { error: { message: 'duplicate key value violates unique constraint' } },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', code: 'data_access_unavailable' })
    expect(JSON.stringify(body)).not.toContain('duplicate key')
  })

  it('10. inserts via the service client and returns 200 generated on success', async () => {
    fetchMock.mockResolvedValue(ytOk([ytItem('vid123', '하세나 제목')]))
    const { client, summariesBuilders } = serviceClient({})
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      staleTokens: [],
    })

    const res = await GET(cronRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'generated', videoId: 'vid123', title: '하세나 제목' })

    // The insert ran through the third hasena_summaries builder (service client).
    const insertBuilder = summariesBuilders[2]
    expect(insertBuilder.insert).toHaveBeenCalledTimes(1)
    const inserted = vi.mocked(insertBuilder.insert as () => unknown).mock.calls[0][0]
    expect(inserted).toMatchObject({ video_id: 'vid123', title: '하세나 제목' })
  })

  it('11. reads notification settings and tokens through the service client after success', async () => {
    fetchMock.mockResolvedValue(ytOk([ytItem('vid123', '하세나 제목')]))
    const { client, from, settingsBuilder, fcmSelectBuilder } = serviceClient({
      settings: { data: [{ user_id: 'u1' }] },
      tokens: { data: [{ token: 't1' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      staleTokens: [],
    })

    const res = await GET(cronRequest())
    expect(res.status).toBe(200)

    // The notification fanout is fire-and-forget and awaits a dynamic
    // `import('@/lib/firebase/send')`, which settles on a real macrotask; drop
    // fake timers so the microtask/macrotask queue drains before asserting.
    vi.useRealTimers()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushMicrotasks()

    expect(from).toHaveBeenCalledWith('notification_settings')
    expect(from).toHaveBeenCalledWith('fcm_tokens')
    expect(settingsBuilder.select).toHaveBeenCalled()
    expect(fcmSelectBuilder.select).toHaveBeenCalled()
    expect(sendMulticastNotification).toHaveBeenCalledWith(
      ['t1'],
      expect.any(String),
      expect.any(String),
      { url: '/hasena' }
    )
  })
})
