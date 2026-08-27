/**
 * Whether a refresh attempt failed because the server said no, or because the
 * request never got there.
 *
 * `rejected` means the server answered and refused: the session really is over.
 * `unreachable` means the attempt could not be completed — offline, DNS, TLS,
 * timeout, a 5xx from a proxy. Those are not the same answer, and collapsing
 * them into one boolean is what makes a subway tunnel look like a revoked
 * session.
 */
export type RefreshFailureReason = 'rejected' | 'unreachable'

export type RefreshOutcome =
  | boolean
  | { ok: true }
  | { ok: false; reason: RefreshFailureReason }

export interface AuthRefreshDependencies<User> {
  fetchUser: () => Promise<User | null>
  refreshToken: (options: { logoutOnFailure: boolean }) => Promise<RefreshOutcome>
  logout: () => Promise<void>
  /**
   * Called when the session state could not be determined. The caller is
   * expected to hold the session and show a neutral retry surface rather than
   * treating the user as signed out.
   */
  onUnreachable?: () => void
}

export interface AuthRefreshOptions {
  logoutOnFailure?: boolean
}

interface NormalisedOutcome {
  ok: boolean
  reason: RefreshFailureReason | null
}

/**
 * Accepts both the boolean shape and the reasoned shape.
 *
 * A bare `false` keeps its original meaning (`rejected`) so existing callers
 * behave exactly as before. Anything unrecognised is treated as `rejected`
 * rather than `unreachable`: guessing "offline" for a shape we do not understand
 * would keep a genuinely revoked session alive.
 */
function normaliseOutcome(outcome: RefreshOutcome): NormalisedOutcome {
  if (outcome === true) return { ok: true, reason: null }
  if (outcome === false) return { ok: false, reason: 'rejected' }
  if (outcome && typeof outcome === 'object' && 'ok' in outcome) {
    if (outcome.ok) return { ok: true, reason: null }
    const reason = (outcome as { reason?: RefreshFailureReason }).reason
    return { ok: false, reason: reason === 'unreachable' ? 'unreachable' : 'rejected' }
  }
  return { ok: false, reason: 'rejected' }
}

export async function fetchUserWithRefreshPolicy<User>(
  dependencies: AuthRefreshDependencies<User>,
  options: AuthRefreshOptions = {},
): Promise<User | null> {
  const user = await dependencies.fetchUser()
  if (user) return user

  const outcome = normaliseOutcome(
    await dependencies.refreshToken({ logoutOnFailure: false }),
  )

  if (!outcome.ok) {
    if (outcome.reason === 'unreachable') {
      // Deliberately no logout, on either policy. The session may well still be
      // valid; we simply could not ask. Signing the user out here is the bug
      // this branch exists to prevent.
      dependencies.onUnreachable?.()
      return null
    }
    if (options.logoutOnFailure) {
      await dependencies.logout()
    }
    return null
  }

  return dependencies.fetchUser()
}

export function revalidateAuthSession<User>(
  dependencies: AuthRefreshDependencies<User>,
): Promise<User | null> {
  return fetchUserWithRefreshPolicy(dependencies, { logoutOnFailure: true })
}

export interface InitialAuthDependencies<User> {
  fetchUser: () => Promise<User | null>
  fetchUserWithRefresh: () => Promise<User | null>
}

export function fetchInitialAuthUser<User>(
  cachedUser: User | null,
  dependencies: InitialAuthDependencies<User>,
): Promise<User | null> {
  return cachedUser
    ? dependencies.fetchUserWithRefresh()
    : dependencies.fetchUser()
}
