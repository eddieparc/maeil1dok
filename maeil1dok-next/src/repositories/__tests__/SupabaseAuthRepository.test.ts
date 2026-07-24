import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseAuthRepository } from '@/repositories/implementations/SupabaseAuthRepository'
import { AuthError } from '@/repositories/types/errors'
import type { UserIdentity } from '@/types'

function createMockSupabase() {
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: {} } },
    }),
    getUserIdentities: vi.fn(),
    linkIdentity: vi.fn(),
    unlinkIdentity: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
  }

  return { auth: mockAuth }
}

const mockIdentityRow = {
  id: 'identity-1',
  provider: 'kakao',
  identity_data: { email: 'test@kakao.com' },
  created_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-15T00:00:00.000Z',
}

const expectedIdentity: UserIdentity = {
  id: 'identity-1',
  identityId: 'identity-1',
  provider: 'kakao',
  email: 'test@kakao.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastSignInAt: '2026-01-15T00:00:00.000Z',
}

describe('SupabaseAuthRepository — Plan E methods', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>
  let repo: SupabaseAuthRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    repo = new SupabaseAuthRepository(mockSupabase as never)
  })

  describe('getUserIdentities', () => {
    it('returns mapped UserIdentity array', async () => {
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [mockIdentityRow] },
        error: null,
      })

      const result = await repo.getUserIdentities()

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(expectedIdentity)
    })

    it('returns empty array when no identities', async () => {
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [] },
        error: null,
      })

      const result = await repo.getUserIdentities()
      expect(result).toEqual([])
    })

    it('handles missing created_at with empty string fallback', async () => {
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: {
          identities: [{
            ...mockIdentityRow,
            created_at: undefined,
            last_sign_in_at: undefined,
          }],
        },
        error: null,
      })

      const result = await repo.getUserIdentities()

      expect(result[0].createdAt).toBe('')
      expect(result[0].lastSignInAt).toBeUndefined()
    })

    it('throws AuthError on failure', async () => {
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: null,
        error: { message: 'Failed to get identities' },
      })

      await expect(repo.getUserIdentities()).rejects.toThrow(AuthError)
    })
  })

  describe('linkIdentity', () => {
    it('calls supabase.auth.linkIdentity with provider', async () => {
      mockSupabase.auth.linkIdentity.mockResolvedValue({ error: null })

      await repo.linkIdentity('google')

      expect(mockSupabase.auth.linkIdentity).toHaveBeenCalledWith({
        provider: 'google',
        options: undefined,
      })
    })

    it('passes redirectTo when provided', async () => {
      mockSupabase.auth.linkIdentity.mockResolvedValue({ error: null })

      await repo.linkIdentity('kakao', 'https://example.com/callback')

      expect(mockSupabase.auth.linkIdentity).toHaveBeenCalledWith({
        provider: 'kakao',
        options: { redirectTo: 'https://example.com/callback' },
      })
    })

    it('throws AuthError on failure', async () => {
      mockSupabase.auth.linkIdentity.mockResolvedValue({
        error: { message: 'Link failed' },
      })

      await expect(repo.linkIdentity('google')).rejects.toThrow(AuthError)
    })
  })

  describe('unlinkIdentity', () => {
    it('throws AuthError when only 1 identity and no password', async () => {
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [mockIdentityRow] },
        error: null,
      })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: {} } },
      })

      await expect(repo.unlinkIdentity('identity-1')).rejects.toThrow(
        '마지막 로그인 방법은 해제할 수 없습니다'
      )
    })

    it('succeeds when 2 identities exist', async () => {
      const secondIdentity = { ...mockIdentityRow, id: 'identity-2', provider: 'google' }
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [mockIdentityRow, secondIdentity] },
        error: null,
      })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: {} } },
      })
      mockSupabase.auth.unlinkIdentity.mockResolvedValue({ error: null })

      await repo.unlinkIdentity('identity-1')

      expect(mockSupabase.auth.unlinkIdentity).toHaveBeenCalledWith({ id: 'identity-1' })
    })

    it('succeeds with 1 identity when has_password is true', async () => {
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [mockIdentityRow] },
        error: null,
      })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: { has_password: true } } },
      })
      mockSupabase.auth.unlinkIdentity.mockResolvedValue({ error: null })

      await repo.unlinkIdentity('identity-1')

      expect(mockSupabase.auth.unlinkIdentity).toHaveBeenCalledWith({ id: 'identity-1' })
    })

    it('throws AuthError on supabase unlinkIdentity error', async () => {
      const secondIdentity = { ...mockIdentityRow, id: 'identity-2', provider: 'google' }
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [mockIdentityRow, secondIdentity] },
        error: null,
      })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: {} } },
      })
      mockSupabase.auth.unlinkIdentity.mockResolvedValue({
        error: { message: 'Unlink failed' },
      })

      await expect(repo.unlinkIdentity('identity-1')).rejects.toThrow(AuthError)
    })

    it('throws AuthError and does not call unlinkIdentity for a non-owned identity id', async () => {
      const secondIdentity = { ...mockIdentityRow, id: 'identity-2', provider: 'google' }
      mockSupabase.auth.getUserIdentities.mockResolvedValue({
        data: { identities: [mockIdentityRow, secondIdentity] },
        error: null,
      })
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: {} } },
      })
      mockSupabase.auth.unlinkIdentity.mockResolvedValue({ error: null })

      await expect(repo.unlinkIdentity('foreign-identity')).rejects.toThrow(
        '연결된 로그인 방법을 찾을 수 없습니다'
      )
      expect(mockSupabase.auth.unlinkIdentity).not.toHaveBeenCalled()
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled()
    })
  })

  describe('updatePassword', () => {
    it('calls supabase.auth.updateUser with new password when no current password proof is required', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({ error: null })

      await repo.updatePassword('newSecurePass123')

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newSecurePass123',
      })
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled()
    })

    it('throws AuthError on failure', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        error: { message: 'Weak password' },
      })

      await expect(repo.updatePassword('123')).rejects.toThrow(AuthError)
    })

    it('verifies the current password via signInWithPassword before updateUser', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: {} } },
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })
      mockSupabase.auth.updateUser.mockResolvedValue({ error: null })

      await repo.updatePassword('newSecurePass123', 'old-pass-123')

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'old-pass-123',
      })
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newSecurePass123',
      })
      expect(
        mockSupabase.auth.signInWithPassword.mock.invocationCallOrder[0]
      ).toBeLessThan(mockSupabase.auth.updateUser.mock.invocationCallOrder[0])
    })

    it('does not call updateUser when the current password is wrong', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: {} } },
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      await expect(repo.updatePassword('newSecurePass123', 'wrong-pass')).rejects.toThrow(
        '현재 비밀번호가 일치하지 않습니다'
      )
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('does not call updateUser when signInWithPassword returns a different user id', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: {} } },
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'other-user' } },
        error: null,
      })

      await expect(repo.updatePassword('newSecurePass123', 'old-pass-123')).rejects.toThrow(
        '현재 비밀번호가 일치하지 않습니다'
      )
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('throws AuthError and skips updateUser when the current user has no email', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', user_metadata: {} } },
      })

      await expect(repo.updatePassword('newSecurePass123', 'old-pass-123')).rejects.toThrow(
        '현재 비밀번호를 확인할 수 없습니다'
      )
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled()
      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled()
    })
  })

  describe('resetPasswordForEmail', () => {
    it('calls supabase.auth.resetPasswordForEmail', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

      await repo.resetPasswordForEmail('test@example.com')

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com')
    })

    it('throws AuthError on failure', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Rate limit exceeded' },
      })

      await expect(repo.resetPasswordForEmail('test@example.com')).rejects.toThrow(AuthError)
    })
  })

  describe('deleteAccount', () => {
    it('soft-deletes by updating user metadata then signs out', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      mockSupabase.auth.updateUser.mockResolvedValue({ error: null })
      mockSupabase.auth.signOut.mockResolvedValue({ error: null })

      await repo.deleteAccount()

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: expect.objectContaining({ deleted_at: expect.any(String) }),
      })
      expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
    })

    it('throws AuthError when user not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      await expect(repo.deleteAccount()).rejects.toThrow('User not found')
    })

    it('throws AuthError when updateUser fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      mockSupabase.auth.updateUser.mockResolvedValue({
        error: { message: 'Update failed' },
      })

      await expect(repo.deleteAccount()).rejects.toThrow(AuthError)
    })
  })
})
