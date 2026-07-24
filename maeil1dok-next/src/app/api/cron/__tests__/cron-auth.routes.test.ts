import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/hasena/hasenaSync', () => ({
  syncHasenaEntries: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/firebase/send', () => ({
  sendMulticastNotification: vi.fn(),
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(),
}))

import { syncHasenaEntries } from '@/lib/hasena/hasenaSync'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { GET as hasenaSyncGet } from '@/app/api/cron/hasena-sync/route'
import { GET as dailyReminderGet } from '@/app/api/cron/daily-reminder/route'
import { GET as hasenaSummaryGet } from '@/app/api/cron/hasena-summary/route'

const ORIGINAL_SECRET = process.env.CRON_SECRET
const SECRET = 'cron-secret-under-test'

function cronRequest(url: string, header?: string) {
  return new Request(url, {
    method: 'GET',
    headers: header !== undefined ? { authorization: header } : {},
  }) as never
}

const routes = [
  {
    name: 'hasena-sync',
    url: 'http://localhost/api/cron/hasena-sync',
    handler: hasenaSyncGet,
  },
  {
    name: 'daily-reminder',
    url: 'http://localhost/api/cron/daily-reminder',
    handler: dailyReminderGet,
  },
  {
    name: 'hasena-summary',
    url: 'http://localhost/api/cron/hasena-summary',
    handler: hasenaSummaryGet,
  },
] as const

describe('cron route authorization gate — no effect before authz', () => {
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

  for (const route of routes) {
    describe(route.name, () => {
      it('returns 401 for a wrong secret and touches no dependency', async () => {
        const res = await route.handler(cronRequest(route.url, 'Bearer wrong'))
        expect(res.status).toBe(401)
        expect(syncHasenaEntries).not.toHaveBeenCalled()
        expect(createClient).not.toHaveBeenCalled()
        expect(createServiceRoleClient).not.toHaveBeenCalled()
      })

      it('returns 401 when the authorization header is missing', async () => {
        const res = await route.handler(cronRequest(route.url))
        expect(res.status).toBe(401)
        expect(syncHasenaEntries).not.toHaveBeenCalled()
        expect(createClient).not.toHaveBeenCalled()
        expect(createServiceRoleClient).not.toHaveBeenCalled()
      })

      it('fails closed with 503 when CRON_SECRET is unset (even for "Bearer undefined")', async () => {
        delete process.env.CRON_SECRET
        const res = await route.handler(cronRequest(route.url, 'Bearer undefined'))
        expect(res.status).toBe(503)
        expect(syncHasenaEntries).not.toHaveBeenCalled()
        expect(createClient).not.toHaveBeenCalled()
        expect(createServiceRoleClient).not.toHaveBeenCalled()
      })
    })
  }
})
