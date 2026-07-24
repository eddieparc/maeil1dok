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
import { POST } from '@/app/api/auth/update-password/route'

const PASSWORD_POLICY_ERROR = '비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다'

function createMockSupabase(
  userOverride?: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null
) {
  const user =
    userOverride === null ? null : (userOverride ?? { id: 'viewer-user', email: 'viewer@example.com' })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

function createJsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/update-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createRawRequest(rawBody: string): Request {
  return new Request('http://localhost/api/auth/update-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  })
}

describe('POST /api/auth/update-password', () => {
  const updatePassword = vi.fn()
  const resetPasswordForEmail = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
    vi.mocked(createServerRepositories).mockReturnValue({
      auth: { updatePassword, resetPasswordForEmail },
    } as never)
  })

  it('returns 401 for an unauthenticated malformed JSON request before parsing or repository access', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await POST(createRawRequest('{'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: '인증이 필요합니다' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('returns 401 for an unauthenticated valid JSON request before repository construction', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase(null) as never)

    const res = await POST(createJsonRequest({ newPassword: 'abcd1234' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: '인증이 필요합니다' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it.each(['{', ''])(
    'returns 400 Invalid JSON body for authenticated malformed or empty JSON without repository access',
    async (body) => {
      const res = await POST(createRawRequest(body))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json).toEqual({ error: 'Invalid JSON body' })
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updatePassword).not.toHaveBeenCalled()
      expect(resetPasswordForEmail).not.toHaveBeenCalled()
    }
  )

  it.each([null, [], 'not-an-object', 42, true])(
    'returns the password-policy 400 for non-object top-level bodies without repository access',
    async (body) => {
      const res = await POST(createJsonRequest(body))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json).toEqual({ error: PASSWORD_POLICY_ERROR })
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updatePassword).not.toHaveBeenCalled()
      expect(resetPasswordForEmail).not.toHaveBeenCalled()
    }
  )

  it.each([
    {},
    { newPassword: '' },
    { newPassword: '        ' },
    { newPassword: 'short1' },
    { newPassword: 'abcdefgh' },
    { newPassword: '12345678' },
    { newPassword: 12345678 },
    { newPassword: {} },
    { newPassword: [] },
    { newPassword: ['a', '1', 'b', 'c', 'd', 'e', 'f', 'g'] },
  ])('returns the password-policy 400 for invalid password bodies without repository access', async (body) => {
    const res = await POST(createJsonRequest(body))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: PASSWORD_POLICY_ERROR })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('updates the password once for a valid body and returns success', async () => {
    updatePassword.mockResolvedValue(undefined)

    const res = await POST(createJsonRequest({ newPassword: 'abcd1234' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(updatePassword).toHaveBeenCalledTimes(1)
    expect(updatePassword).toHaveBeenCalledWith('abcd1234', undefined)
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('returns 400 before repository construction when a password-backed user omits currentPassword', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockSupabase({
        id: 'viewer-user',
        email: 'viewer@example.com',
        user_metadata: { has_password: true },
      }) as never
    )

    const res = await POST(createJsonRequest({ newPassword: 'abcd1234' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: '현재 비밀번호를 입력해 주세요' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it.each(['', '   '])(
    'returns 400 before repository construction when a password-backed user sends a blank currentPassword',
    async (currentPassword) => {
      vi.mocked(createClient).mockResolvedValue(
        createMockSupabase({
          id: 'viewer-user',
          email: 'viewer@example.com',
          user_metadata: { has_password: true },
        }) as never
      )

      const res = await POST(createJsonRequest({ newPassword: 'abcd1234', currentPassword }))
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json).toEqual({ error: '현재 비밀번호를 입력해 주세요' })
      expect(createServerRepositories).not.toHaveBeenCalled()
      expect(updatePassword).not.toHaveBeenCalled()
    }
  )

  it('passes currentPassword proof to updatePassword for a password-backed user with a valid body', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockSupabase({
        id: 'viewer-user',
        email: 'viewer@example.com',
        user_metadata: { has_password: true },
      }) as never
    )
    updatePassword.mockResolvedValue(undefined)

    const res = await POST(
      createJsonRequest({ newPassword: 'abcd1234', currentPassword: 'old-pass-123' })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(updatePassword).toHaveBeenCalledTimes(1)
    expect(updatePassword).toHaveBeenCalledWith('abcd1234', 'old-pass-123')
  })

  it('returns 400 이메일 정보가 없습니다 for resend-verification without a user email before repository access', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase({ id: 'viewer-user' }) as never)

    const res = await POST(createJsonRequest({ action: 'resend-verification' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: '이메일 정보가 없습니다' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('resends verification once for a user with an email and returns success', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockSupabase({ id: 'viewer-user', email: 'viewer@example.com' }) as never
    )
    resetPasswordForEmail.mockResolvedValue(undefined)

    const res = await POST(createJsonRequest({ action: 'resend-verification' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1)
    expect(resetPasswordForEmail).toHaveBeenCalledWith('viewer@example.com')
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('maps an AuthError from updatePassword to a 400 with its message', async () => {
    updatePassword.mockRejectedValue(new AuthError('New password should be different from the old password'))

    const res = await POST(createJsonRequest({ newPassword: 'abcd1234' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'New password should be different from the old password' })
  })

  it('maps an unexpected error to a 500 with the generic message', async () => {
    updatePassword.mockRejectedValue(new Error('boom'))

    const res = await POST(createJsonRequest({ newPassword: 'abcd1234' }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: '비밀번호 처리 중 오류가 발생했습니다' })
  })
})
