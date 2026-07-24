import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { POST as updatePost } from '@/app/api/profile/update/route'
import { AuthError } from '@/repositories/types/errors'

function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'user-1' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

function createRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/profile/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

describe('POST /api/profile/update — auth and body boundary', () => {
  const updateProfile = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServerRepositories).mockReturnValue({
      profile: { updateProfile },
    } as never)
  })

  describe('unauthenticated', () => {
    it('returns 401 for a valid JSON body and performs NO repository access', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await updatePost(createRequest({ nickname: 'User' }))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })

    it('returns 401 before body parsing even with malformed JSON', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

      const res = await updatePost(createRawRequest('{ not json'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('authenticated malformed JSON', () => {
    it('returns 400 Invalid JSON body and performs NO repository access', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await updatePost(createRawRequest('{"nickname": "x",'))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Invalid JSON body')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('authenticated invalid top-level body', () => {
    it.each([
      ['null', 'null'],
      ['array', '[]'],
      ['string', '"hello"'],
      ['number', '42'],
      ['boolean', 'true'],
    ])('returns 400 and NO repository access for top-level %s', async (_label, rawBody) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await updatePost(createRawRequest(rawBody))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('Request body must be an object')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('invalid nickname', () => {
    it.each([
      ['missing', {}],
      ['null', { nickname: null }],
      ['blank', { nickname: '   ' }],
      ['object', { nickname: {} }],
      ['array', { nickname: [] }],
      ['number', { nickname: 1 }],
      ['boolean', { nickname: true }],
    ])('returns 400 and NO repository access for %s nickname', async (_label, body) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await updatePost(createRequest(body))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('닉네임은 필수입니다')
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('invalid bio', () => {
    it.each([
      ['null', { nickname: 'ok', bio: null }],
      ['object', { nickname: 'ok', bio: {} }],
      ['array', { nickname: 'ok', bio: [] }],
      ['number', { nickname: 'ok', bio: 1 }],
      ['boolean', { nickname: 'ok', bio: true }],
      ['over 500 chars after trim', { nickname: 'ok', bio: `  ${'a'.repeat(501)}  ` }],
    ])('returns 400 and NO repository access for %s bio', async (_label, body) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await updatePost(createRequest(body))

      expect(res.status).toBe(400)
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('invalid isPublic', () => {
    it.each([
      ['null', { nickname: 'ok', isPublic: null }],
      ['string', { nickname: 'ok', isPublic: 'true' }],
      ['object', { nickname: 'ok', isPublic: {} }],
      ['array', { nickname: 'ok', isPublic: [] }],
      ['number', { nickname: 'ok', isPublic: 1 }],
    ])('returns 400 and NO repository access for %s isPublic', async (_label, body) => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)

      const res = await updatePost(createRequest(body))

      expect(res.status).toBe(400)
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updateProfile).not.toHaveBeenCalled()
    })
  })

  describe('valid requests', () => {
    it('updates with trimmed nickname and bio for a full payload', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      updateProfile.mockResolvedValue({ id: 'user-1', nickname: 'User' })

      const res = await updatePost(
        createRequest({ nickname: '  User  ', bio: '  hello  ', isPublic: false })
      )

      expect(res.status).toBe(200)
      expect(updateProfile).toHaveBeenCalledWith({ nickname: 'User', bio: 'hello', isPublic: false })
    })

    it('omits absent optional fields from the update payload', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      updateProfile.mockResolvedValue({ id: 'user-1', nickname: 'User' })

      const res = await updatePost(createRequest({ nickname: 'User' }))

      expect(res.status).toBe(200)
      expect(updateProfile).toHaveBeenCalledWith({ nickname: 'User' })
    })

    it('normalizes a whitespace-only bio to an empty string', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      updateProfile.mockResolvedValue({ id: 'user-1', nickname: 'User' })

      const res = await updatePost(createRequest({ nickname: 'User', bio: '   ' }))

      expect(res.status).toBe(200)
      expect(updateProfile).toHaveBeenCalledWith({ nickname: 'User', bio: '' })
    })
  })

  describe('defensive AuthError fallback', () => {
    it('maps repository AuthError to 401 Unauthorized', async () => {
      vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
      updateProfile.mockRejectedValue(new AuthError('Not authenticated'))

      const res = await updatePost(createRequest({ nickname: 'User' }))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })
  })
})
