import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IAuthRepository, OAuthProvider } from '@/repositories/interfaces/IAuthRepository'
import type { User, Session, UserIdentity } from '@/types'
import { AuthError } from '@/repositories/types/errors'

export class SupabaseAuthRepository implements IAuthRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    })
    if (error) throw new AuthError(error.message, error)
  }

  async signOut(scope: 'local' | 'global' = 'global'): Promise<void> {
    const { error } = await this.supabase.auth.signOut({ scope })
    if (error) throw new AuthError(error.message, error)
  }

  async getUser(): Promise<User | null> {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    // "Auth session missing" = unauthenticated user, not an error
    if (!user) return null
    if (error) throw new AuthError(error.message, error)

    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? user.created_at,
      emailConfirmedAt: user.email_confirmed_at ?? undefined,
      lastSignInAt: user.last_sign_in_at ?? undefined,
      role: user.role,
      userMetadata: user.user_metadata,
    }
  }

  async getSession(): Promise<Session | null> {
    const { data: { session }, error } = await this.supabase.auth.getSession()
    if (error) throw new AuthError(error.message, error)
    if (!session) return null

    const user = await this.getUser()
    if (!user) return null

    return {
      accessToken: session.access_token,
      tokenType: session.token_type,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at ?? 0,
      refreshToken: session.refresh_token,
      user,
    }
  }

  async refreshSession(): Promise<Session> {
    const { data: { session }, error } = await this.supabase.auth.refreshSession()
    if (error) throw new AuthError(error.message, error)
    if (!session) throw new AuthError('Failed to refresh session')

    const user = await this.getUser()
    if (!user) throw new AuthError('User not found after refresh')

    return {
      accessToken: session.access_token,
      tokenType: session.token_type,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at ?? 0,
      refreshToken: session.refresh_token,
      user,
    }
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          try {
            const user = await this.getUser()
            callback(user)
          } catch {
            callback(null)
          }
        } else {
          callback(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }

  async getUserIdentities(): Promise<UserIdentity[]> {
    const { data, error } = await this.supabase.auth.getUserIdentities()
    if (error) throw new AuthError(error.message, error)
    return (data?.identities ?? []).map(identity => ({
      id: identity.id,
      identityId: identity.id,
      provider: identity.provider,
      email: identity.identity_data?.email as string | undefined,
      createdAt: identity.created_at ?? '',
      lastSignInAt: identity.last_sign_in_at ?? undefined,
    }))
  }

  async linkIdentity(provider: OAuthProvider, redirectTo?: string): Promise<void> {
    const { error } = await this.supabase.auth.linkIdentity({
      provider,
      options: redirectTo ? { redirectTo } : undefined,
    })
    if (error) throw new AuthError(error.message, error)
  }

  async unlinkIdentity(identityId: string): Promise<void> {
    // Object-level authorization: only allow unlinking an identity that
    // actually belongs to the current user's Supabase identity list.
    const identities = await this.getUserIdentities()
    const ownsIdentity = identities.some(
      identity => identity.identityId === identityId || identity.id === identityId
    )

    if (!ownsIdentity) {
      throw new AuthError('연결된 로그인 방법을 찾을 수 없습니다')
    }

    // Guard: count total auth methods (identities + password)
    const { data: { user } } = await this.supabase.auth.getUser()
    const hasPassword = !!(user?.user_metadata?.has_password)
    const totalMethods = identities.length + (hasPassword ? 1 : 0)

    if (totalMethods <= 1) {
      throw new AuthError('마지막 로그인 방법은 해제할 수 없습니다')
    }

    const { error } = await this.supabase.auth.unlinkIdentity(
      { id: identityId } as any
    )
    if (error) throw new AuthError(error.message, error)
  }

  async updatePassword(newPassword: string, currentPassword?: string): Promise<void> {
    if (currentPassword !== undefined) {
      await this.verifyCurrentPassword(currentPassword)
    }

    const { error } = await this.supabase.auth.updateUser({ password: newPassword })
    if (error) throw new AuthError(error.message, error)
  }

  private async verifyCurrentPassword(currentPassword: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser()

    if (!user?.email) {
      throw new AuthError('현재 비밀번호를 확인할 수 없습니다')
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (error || !data?.user || data.user.id !== user.id) {
      throw new AuthError('현재 비밀번호가 일치하지 않습니다')
    }
  }

  async resetPasswordForEmail(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email)
    if (error) throw new AuthError(error.message, error)
  }

  async deleteAccount(): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new AuthError('User not found')

    // Soft delete: update user metadata with deleted_at
    const { error } = await this.supabase.auth.updateUser({
      data: { deleted_at: new Date().toISOString() }
    })
    if (error) throw new AuthError(error.message, error)

    // Sign out
    await this.signOut()
  }
}
