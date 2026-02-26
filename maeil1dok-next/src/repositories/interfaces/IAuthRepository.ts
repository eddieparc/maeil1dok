import type { User, Session } from '@/types'

export type OAuthProvider = 'kakao' | 'google' | 'apple'

export interface IAuthRepository {
  /**
   * Initiates OAuth flow — redirects to provider
   */
  signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<void>

  /**
   * Signs out user. ALWAYS use global scope by default.
   */
  signOut(scope?: 'local' | 'global'): Promise<void>

  /**
   * Gets currently authenticated user (server-safe via getUser())
   */
  getUser(): Promise<User | null>

  /**
   * Gets current session with tokens
   */
  getSession(): Promise<Session | null>

  /**
   * Refreshes expired access token
   */
  refreshSession(): Promise<Session>

  /**
   * Subscribe to auth state changes. Returns unsubscribe function.
   */
  onAuthStateChange(callback: (user: User | null) => void): () => void
}
