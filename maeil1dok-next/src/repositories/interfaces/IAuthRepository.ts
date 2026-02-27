import type { User, Session, UserIdentity } from '@/types'

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

  /**
   * Get all linked OAuth identities for current user
   */
  getUserIdentities(): Promise<UserIdentity[]>

  /**
   * Link a new OAuth provider to current user (redirects to OAuth)
   */
  linkIdentity(provider: OAuthProvider, redirectTo?: string): Promise<void>

  /**
   * Unlink an OAuth provider (with last-method guard)
   */
  unlinkIdentity(identityId: string): Promise<void>

  /**
   * Set or change password
   */
  updatePassword(newPassword: string): Promise<void>

  /**
   * Send password reset email
   */
  resetPasswordForEmail(email: string): Promise<void>

  /**
   * Soft-delete user account
   */
  deleteAccount(): Promise<void>
}
