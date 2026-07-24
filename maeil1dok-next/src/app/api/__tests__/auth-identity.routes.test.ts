import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '@/repositories/types/errors'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/repositories/factory', () => ({
  createServerRepositories: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { POST as linkPost } from '@/app/api/auth/link-identity/route'
import { POST as unlinkPost } from '@/app/api/auth/unlink-identity/route'

const linkIdentity = vi.fn()
const unlinkIdentity = vi.fn()

function createMockSupabase(userOverride?: { id: string } | null) {
  const user = userOverride === null ? null : (userOverride ?? { id: 'viewer-user' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      linkIdentity,
    },
  }
}

function createJsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createRawPostRequest(path: string, body: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
  vi.mocked(createServerRepositories).mockReturnValue({
    auth: { unlinkIdentity },
  } as never)
  linkIdentity.mockResolvedValue({ data: { url: 'https://oauth.example/link' }, error: null })
  unlinkIdentity.mockResolvedValue(undefined)
})

describe('POST /api/auth/link-identity', () => {
  it('returns 401 for unauthenticated malformed JSON before parsing/mutation', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await linkPost(createRawPostRequest('/api/auth/link-identity', '{bad json'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('인증이 필요합니다')
    expect(linkIdentity).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON', async () => {
    const res = await linkPost(createRawPostRequest('/api/auth/link-identity', '{bad json'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid JSON body')
    expect(linkIdentity).not.toHaveBeenCalled()
  })

  it.each([
    ['null body', null],
    ['array body', ['kakao']],
    ['string body', 'kakao'],
    ['empty object', {}],
    ['non-string provider', { provider: 123 }],
    ['unsupported provider', { provider: 'facebook' }],
  ])('returns 400 provider error and does not call linkIdentity for %s', async (_label, body) => {
    const res = await linkPost(createJsonRequest('/api/auth/link-identity', body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('유효하지 않은 OAuth 제공자입니다')
    expect(linkIdentity).not.toHaveBeenCalled()
  })

  it('calls linkIdentity once and returns url for a valid provider', async () => {
    const res = await linkPost(createJsonRequest('/api/auth/link-identity', { provider: 'google' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.url).toBe('https://oauth.example/link')
    expect(linkIdentity).toHaveBeenCalledTimes(1)
    expect(linkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    )
  })
})

describe('POST /api/auth/unlink-identity', () => {
  it('returns 401 for unauthenticated malformed JSON before repository construction', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await unlinkPost(createRawPostRequest('/api/auth/unlink-identity', '{bad json'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('인증이 필요합니다')
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(unlinkIdentity).not.toHaveBeenCalled()
  })

  it('returns 400 Invalid JSON body for authenticated malformed JSON', async () => {
    const res = await unlinkPost(createRawPostRequest('/api/auth/unlink-identity', '{bad json'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid JSON body')
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(unlinkIdentity).not.toHaveBeenCalled()
  })

  it.each([
    ['null body', null],
    ['array body', ['id-1']],
    ['string body', 'id-1'],
    ['empty object', {}],
    ['blank identityId', { identityId: '   ' }],
    ['non-string identityId', { identityId: 42 }],
  ])('returns 400 identityId error and does not construct repositories for %s', async (_label, body) => {
    const res = await unlinkPost(createJsonRequest('/api/auth/unlink-identity', body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('identityId가 필요합니다')
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(unlinkIdentity).not.toHaveBeenCalled()
  })

  it('constructs repositories after auth and unlinks the trimmed identity id', async () => {
    const res = await unlinkPost(
      createJsonRequest('/api/auth/unlink-identity', { identityId: '  identity-1  ' })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(createServerRepositories).toHaveBeenCalledTimes(1)
    expect(unlinkIdentity).toHaveBeenCalledWith('identity-1')
  })

  it('maps AuthError from unlinkIdentity to a 400 response', async () => {
    unlinkIdentity.mockRejectedValue(new AuthError('연결된 로그인 방법을 찾을 수 없습니다'))

    const res = await unlinkPost(
      createJsonRequest('/api/auth/unlink-identity', { identityId: 'foreign-identity' })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('연결된 로그인 방법을 찾을 수 없습니다')
  })
})
