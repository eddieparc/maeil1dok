import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))

vi.mock('@/lib/notifications/friendActivity', () => ({
  notifyFollowersOfCompletion: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { notifyFollowersOfCompletion } from '@/lib/notifications/friendActivity'
import { POST } from '@/app/api/hasena/complete/route'

function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'user-1' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

function createRequest(body?: unknown): Request {
  return new Request('http://localhost/api/hasena/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function createRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/hasena/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

describe('POST /api/hasena/complete — validation before effect', () => {
  const markHasenaComplete = vi.fn()
  const markHasenaIncomplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServerRepositories).mockReturnValue({
      hasena: { markHasenaComplete, markHasenaIncomplete },
    } as never)
  })

  describe('authentication', () => {
    it('returns 401 before body parsing and repository access when unauthenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await POST(createRequest({ date: '2026-07-11', completed: true }))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })

    it('returns 401 before body parsing even with malformed JSON when unauthenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await POST(createRawRequest('not json at all'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(markHasenaIncomplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('malformed JSON body', () => {
    it('returns 400 Invalid JSON body and performs NO repository access when authenticated', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await POST(createRawRequest('{"date": "2026-07-11",'))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(markHasenaIncomplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('top-level non-object bodies', () => {
    it.each([
      ['null', 'null'],
      ['array', '[]'],
      ['string primitive', '"hello"'],
      ['number primitive', '42'],
      ['boolean primitive', 'true'],
    ])('returns 400 and performs NO repository access for top-level %s body', async (_label, rawBody) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await POST(createRawRequest(rawBody))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Request body must be an object')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(markHasenaIncomplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('invalid date values', () => {
    it.each([
      ['missing', {}],
      ['empty string', { date: '' }],
      ['whitespace string', { date: '   ' }],
      ['non-string number', { date: 20260711 }],
      ['object', { date: {} }],
      ['array', { date: ['2026-07-11'] }],
      ['datetime string', { date: '2026-07-11T00:00:00Z' }],
      ['wrong separator', { date: '2026/07/11' }],
      ['short format', { date: '2026-7-1' }],
      ['invalid month', { date: '2026-13-01' }],
      ['invalid day', { date: '2026-07-00' }],
      ['impossible date', { date: '2026-02-30' }],
    ])('returns 400 date error and NO repository access for %s date', async (_label, overrides) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await POST(createRequest({ completed: true, ...overrides }))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('date must be YYYY-MM-DD')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(markHasenaIncomplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('invalid completed values', () => {
    it.each([
      ['missing', {}],
      ['null', { completed: null }],
      ['string', { completed: 'true' }],
      ['number', { completed: 1 }],
      ['object', { completed: {} }],
      ['array', { completed: [true] }],
    ])('returns 400 completed error and NO repository access for %s completed', async (_label, overrides) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await POST(createRequest({ date: '2026-07-11', ...overrides }))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('completed must be boolean')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(markHasenaIncomplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })

  describe('valid requests', () => {
    it('marks complete and notifies followers for a valid completion', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      markHasenaComplete.mockResolvedValue({ date: '2026-07-11', isCompleted: true })

      const res = await POST(createRequest({ date: '2026-07-11', completed: true }))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual({ date: '2026-07-11', isCompleted: true })
      expect(markHasenaComplete).toHaveBeenCalledWith('2026-07-11')
      expect(markHasenaIncomplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).toHaveBeenCalledWith('user-1', 'hasena')
    })

    it('marks incomplete and does NOT notify followers for a valid uncompletion', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      markHasenaIncomplete.mockResolvedValue({ date: '2026-07-11', isCompleted: false })

      const res = await POST(createRequest({ date: '2026-07-11', completed: false }))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual({ date: '2026-07-11', isCompleted: false })
      expect(markHasenaIncomplete).toHaveBeenCalledWith('2026-07-11')
      expect(markHasenaComplete).not.toHaveBeenCalled()
      expect(notifyFollowersOfCompletion).not.toHaveBeenCalled()
    })
  })
})
