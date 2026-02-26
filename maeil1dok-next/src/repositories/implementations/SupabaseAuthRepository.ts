import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IAuthRepository, OAuthProvider } from '@/repositories/interfaces/IAuthRepository'
import type { User, Session } from '@/types'
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
    if (error) throw new AuthError(error.message, error)
    if (!user) return null

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
}
