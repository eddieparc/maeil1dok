import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { POST as subscribePost } from '@/app/api/plans/subscribe/route'
import { POST as unsubscribePost } from '@/app/api/plans/unsubscribe/route'
import { NotFoundError } from '@/repositories/types/errors'

function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'user-1' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

function createRequest(body?: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function createRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

describe('Plan subscription API routes — authz before effect', () => {
  const subscribeToPlan = vi.fn()
  const unsubscribeFromPlan = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServerRepositories).mockReturnValue({
      plan: { subscribeToPlan, unsubscribeFromPlan },
    } as never)
  })

  describe('POST /api/plans/subscribe', () => {
    it('subscribes for an authenticated user', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      subscribeToPlan.mockResolvedValue({ id: 'sub-1', planId: 1 })

      const res = await subscribePost(createRequest({ planId: 1, startDate: '2026-07-08' }))

      expect(res.status).toBe(200)
      expect(subscribeToPlan).toHaveBeenCalledWith(1, '2026-07-08')
    })

    it('returns 404 Plan not found when the repository rejects with NotFoundError', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      subscribeToPlan.mockRejectedValue(
        new NotFoundError('Plan not found', 'bible_reading_plans'),
      )

      const res = await subscribePost(createRequest({ planId: 99, startDate: '2026-07-08' }))
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('Plan not found')
      expect(subscribeToPlan).toHaveBeenCalledWith(99, '2026-07-08')
    })

    it('returns 401 and performs NO subscription write when not authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await subscribePost(createRequest({ planId: 1, startDate: '2026-07-08' }))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(subscribeToPlan).not.toHaveBeenCalled()
    })

    it('returns 400 Invalid JSON body and performs NO repository access on malformed JSON when authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await subscribePost(createRawRequest('{"planId": 1,'))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(subscribeToPlan).not.toHaveBeenCalled()
    })

    it('returns 401 before body parsing when unauthenticated even with malformed JSON', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await subscribePost(createRawRequest('not json at all'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(subscribeToPlan).not.toHaveBeenCalled()
    })

    it.each([
      ['null', 'null'],
      ['array', '[]'],
      ['number primitive', '42'],
      ['string primitive', '"hello"'],
      ['boolean primitive', 'true'],
    ])('returns 400 and performs NO repository access for top-level %s body', async (_label, rawBody) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await subscribePost(createRawRequest(rawBody))

      expect(res.status).toBe(400)
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(subscribeToPlan).not.toHaveBeenCalled()
    })

    it.each([
      ['missing', {}],
      ['null', { planId: null }],
      ['zero', { planId: 0 }],
      ['negative', { planId: -1 }],
      ['fractional', { planId: 1.5 }],
      ['string', { planId: '1' }],
      ['object', { planId: {} }],
      ['array', { planId: [1] }],
    ])('returns 400 planId error and NO repository access for %s planId', async (_label, overrides) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await subscribePost(createRequest({ startDate: '2026-07-08', ...overrides }))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('planId must be a positive integer')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(subscribeToPlan).not.toHaveBeenCalled()
    })

    it.each([
      ['missing', {}],
      ['blank', { startDate: '' }],
      ['non-string', { startDate: 20260708 }],
      ['datetime', { startDate: '2026-07-08T00:00:00Z' }],
      ['wrong format', { startDate: '2026/07/08' }],
      ['short format', { startDate: '2026-7-8' }],
      ['invalid month', { startDate: '2026-13-01' }],
      ['invalid day', { startDate: '2026-07-00' }],
      ['impossible date', { startDate: '2026-02-30' }],
    ])('returns 400 startDate error and NO repository access for %s startDate', async (_label, overrides) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await subscribePost(createRequest({ planId: 1, ...overrides }))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('startDate must be YYYY-MM-DD')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(subscribeToPlan).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/plans/unsubscribe', () => {
    const VALID_UUID = '11111111-1111-4111-8111-111111111111'

    it('unsubscribes for an authenticated user', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      unsubscribeFromPlan.mockResolvedValue(undefined)

      const res = await unsubscribePost(createRequest({ subscriptionId: VALID_UUID }))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual({ success: true })
      expect(unsubscribeFromPlan).toHaveBeenCalledWith(VALID_UUID)
    })

    it('returns 401 and performs NO unsubscribe write when not authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await unsubscribePost(createRequest({ subscriptionId: VALID_UUID }))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(unsubscribeFromPlan).not.toHaveBeenCalled()
    })

    it('returns 400 Invalid JSON body and performs NO repository access on malformed JSON when authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await unsubscribePost(createRawRequest('{"subscriptionId":'))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(unsubscribeFromPlan).not.toHaveBeenCalled()
    })

    it('returns 401 before body parsing when unauthenticated even with malformed JSON', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await unsubscribePost(createRawRequest('not json at all'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(unsubscribeFromPlan).not.toHaveBeenCalled()
    })

    it.each([
      ['null', 'null'],
      ['array', '[]'],
      ['string primitive', '"hello"'],
      ['number primitive', '42'],
      ['boolean primitive', 'true'],
    ])('returns 400 Request body must be an object for top-level %s body', async (_label, rawBody) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await unsubscribePost(createRawRequest(rawBody))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Request body must be an object')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(unsubscribeFromPlan).not.toHaveBeenCalled()
    })

    it('returns 400 subscriptionId is required when field is missing', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await unsubscribePost(createRequest({}))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('subscriptionId is required')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(unsubscribeFromPlan).not.toHaveBeenCalled()
    })

    it.each([
      ['null', { subscriptionId: null }],
      ['blank string', { subscriptionId: '' }],
      ['whitespace string', { subscriptionId: '   ' }],
      ['non-UUID string', { subscriptionId: 'sub-1' }],
      ['zero number', { subscriptionId: 0 }],
      ['non-zero number', { subscriptionId: 42 }],
      ['false boolean', { subscriptionId: false }],
      ['true boolean', { subscriptionId: true }],
      ['object', { subscriptionId: {} }],
      ['array', { subscriptionId: [] }],
    ])('returns 400 subscriptionId must be a UUID and NO repository access for %s', async (_label, overrides) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await unsubscribePost(createRequest(overrides))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('subscriptionId must be a UUID')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(unsubscribeFromPlan).not.toHaveBeenCalled()
    })
  })
})
