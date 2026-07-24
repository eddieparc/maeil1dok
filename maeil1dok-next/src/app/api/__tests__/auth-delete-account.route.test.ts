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
import { POST } from '@/app/api/auth/delete-account/route'

function createMockSupabase(
  options: {
    user?: { id: string; email?: string } | null
    error?: unknown
  } = {}
) {
  const user = options.user === undefined ? { id: 'viewer-user', email: 'viewer@example.com' } : options.user
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: options.error ?? null }),
    },
  }
}

describe('POST /api/auth/delete-account', () => {
  const deleteAccount = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(createMockSupabase() as never)
    vi.mocked(createServerRepositories).mockReturnValue({
      auth: { deleteAccount },
    } as never)
  })

  it('returns 401 for an unauthenticated request before repository construction', async () => {
    vi.mocked(createClient).mockResolvedValue(createMockSupabase({ user: null }) as never)

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: '인증이 필요합니다' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('returns 401 when getUser reports an error before repository construction', async () => {
    vi.mocked(createClient).mockResolvedValue(
      createMockSupabase({ user: { id: 'viewer-user' }, error: new Error('session expired') }) as never
    )

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: '인증이 필요합니다' })
    expect(createServerRepositories).not.toHaveBeenCalled()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('deletes the account once for an authenticated user and returns success', async () => {
    deleteAccount.mockResolvedValue(undefined)

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(createServerRepositories).toHaveBeenCalledTimes(1)
    expect(deleteAccount).toHaveBeenCalledTimes(1)
  })

  it('maps an AuthError from deleteAccount to a 400 with its message', async () => {
    deleteAccount.mockRejectedValue(new AuthError('계정을 삭제할 수 없습니다'))

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: '계정을 삭제할 수 없습니다' })
  })

  it('maps an unexpected error to a 500 without exposing the raw message', async () => {
    deleteAccount.mockRejectedValue(new Error('internal supabase failure'))

    const res = await POST()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: '계정 삭제 중 오류가 발생했습니다' })
    expect(JSON.stringify(json)).not.toContain('internal supabase failure')
  })
})
