import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/firebase/send', () => ({
  sendMulticastNotification: vi.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendMulticastNotification } from '@/lib/firebase/send'
import { GET } from '@/app/api/cron/daily-reminder/route'

const ORIGINAL_SECRET = process.env.CRON_SECRET
const SECRET = 'cron-secret-under-test'
const URL = 'http://localhost/api/cron/daily-reminder'

function cronRequest(header?: string) {
  return new Request(URL, {
    method: 'GET',
    headers: header !== undefined ? { authorization: header } : {},
  }) as never
}

/**
 * A thenable Supabase query-builder stub. Every chain method returns `this`, and
 * awaiting the builder resolves to the configured `{ data, error }` result.
 */
function queryResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.in = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: result.data ?? null, error: result.error ?? null })
  return builder
}

/**
 * Build a service-role client stub that routes `.from(table)` to a per-table
 * result. `fcmDelete` captures the delete builder for stale-token assertions.
 */
function serviceClient(config: {
  settings?: { data?: unknown; error?: unknown }
  tokens?: { data?: unknown; error?: unknown }
}) {
  const settingsBuilder = queryResult(config.settings ?? { data: [] })
  const tokensSelectBuilder = queryResult(config.tokens ?? { data: [] })
  const tokensDeleteBuilder = queryResult({ data: null })
  let fcmCall = 0
  const from = vi.fn((table: string) => {
    if (table === 'notification_settings') return settingsBuilder
    if (table === 'fcm_tokens') {
      fcmCall += 1
      return fcmCall === 1 ? tokensSelectBuilder : tokensDeleteBuilder
    }
    throw new Error(`unexpected table ${table}`)
  })
  return { client: { from }, settingsBuilder, tokensSelectBuilder, tokensDeleteBuilder }
}

describe('daily-reminder cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // 09:00 UTC — matches reminder times within ±15 min of 09:00.
    vi.setSystemTime(new Date('2026-07-11T09:00:00Z'))
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    vi.useRealTimers()
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = ORIGINAL_SECRET
    }
  })

  it('returns 401 for a wrong secret without creating any client or sending', async () => {
    const res = await GET(cronRequest('Bearer wrong'))
    expect(res.status).toBe(401)
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 401 when the authorization header is missing', async () => {
    const res = await GET(cronRequest())
    expect(res.status).toBe(401)
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(cronRequest('Bearer undefined'))
    expect(res.status).toBe(503)
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 503 when service credentials are missing, without sending', async () => {
    vi.mocked(createServiceRoleClient).mockImplementation(() => {
      throw new Error('Supabase service credentials are not configured')
    })

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.message).not.toContain('supabase')
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 503 when notification_settings query errors', async () => {
    const { client } = serviceClient({
      settings: { error: { message: 'boom' } },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.message).toBe('Failed to read notification settings')
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 503 when fcm_tokens query errors', async () => {
    const { client } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { error: { message: 'boom' } },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.message).toBe('Failed to read FCM tokens')
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 200 and does not send when there are no eligible settings', async () => {
    const { client } = serviceClient({ settings: { data: [] } })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 0, message: 'No users to notify' })
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 200 and does not send when no users match the time window', async () => {
    const { client } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '23:00' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 0, message: 'No users in current time window' })
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('returns 200 and does not send when matching users have no FCM tokens', async () => {
    const { client } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:05' }] },
      tokens: { data: [] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 0, message: 'No FCM tokens found' })
    expect(sendMulticastNotification).not.toHaveBeenCalled()
  })

  it('sends to matching users and returns sent/failed/staleTokensCleaned', async () => {
    const { client, tokensDeleteBuilder } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { data: [{ user_id: 'u1', token: 't1' }, { user_id: 'u1', token: 't2' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      staleTokens: ['t2'],
    })

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 1, failed: 1, staleTokensCleaned: 1 })
    expect(sendMulticastNotification).toHaveBeenCalledWith(
      ['t1', 't2'],
      expect.any(String),
      expect.any(String),
      { url: '/bible' }
    )
    // Stale cleanup runs on the service client after the multicast response.
    expect(tokensDeleteBuilder.delete).toHaveBeenCalledTimes(1)
    expect(tokensDeleteBuilder.in).toHaveBeenCalledWith('token', ['t2'])
  })

  it('does not run stale cleanup when there are no stale tokens', async () => {
    const { client, tokensDeleteBuilder } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { data: [{ user_id: 'u1', token: 't1' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      staleTokens: [],
    })

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 1, failed: 0, staleTokensCleaned: 0 })
    expect(tokensDeleteBuilder.delete).not.toHaveBeenCalled()
  })

  it('returns 503 when every delivery fails and no failures are stale', async () => {
    const { client, tokensDeleteBuilder } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { data: [{ user_id: 'u1', token: 't1' }, { user_id: 'u1', token: 't2' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      staleTokens: [],
    })

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', message: 'Daily reminder delivery failed' })
    expect(tokensDeleteBuilder.delete).not.toHaveBeenCalled()
  })

  it('runs stale cleanup then returns 503 when all fail with a mix of stale and non-stale', async () => {
    const { client, tokensDeleteBuilder } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { data: [{ user_id: 'u1', token: 't1' }, { user_id: 'u1', token: 't2' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      staleTokens: ['t1'],
    })

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body).toEqual({ status: 'error', message: 'Daily reminder delivery failed' })
    // Stale cleanup must run before the alertable 503 is returned.
    expect(tokensDeleteBuilder.delete).toHaveBeenCalledTimes(1)
    expect(tokensDeleteBuilder.in).toHaveBeenCalledWith('token', ['t1'])
  })

  it('returns 200 after cleanup when every failure is a stale token', async () => {
    const { client, tokensDeleteBuilder } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { data: [{ user_id: 'u1', token: 't1' }, { user_id: 'u1', token: 't2' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      staleTokens: ['t1', 't2'],
    })

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ sent: 0, failed: 2, staleTokensCleaned: 2 })
    expect(tokensDeleteBuilder.delete).toHaveBeenCalledTimes(1)
    expect(tokensDeleteBuilder.in).toHaveBeenCalledWith('token', ['t1', 't2'])
  })

  it('returns sanitized 503 without leaking details when multicast throws', async () => {
    const { client } = serviceClient({
      settings: { data: [{ user_id: 'u1', daily_reminder_time: '09:00' }] },
      tokens: { data: [{ user_id: 'u1', token: 'secret-token-t1' }] },
    })
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never)
    vi.mocked(sendMulticastNotification).mockRejectedValue(
      new Error('FCM provider exploded for user u1 token secret-token-t1')
    )

    const res = await GET(cronRequest(`Bearer ${SECRET}`))
    const body = await res.json()

    expect(res.status).toBe(503)
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('secret-token-t1')
    expect(serialized).not.toContain('u1')
    expect(serialized).not.toContain('provider exploded')
  })
})
