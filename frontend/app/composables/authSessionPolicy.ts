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


export interface RefreshAttemptResult {
  status: number
  ok: boolean
  access?: string
}

export interface RefreshRecoveryDependencies {
  /** Performs one redemption. Reads the current CSRF token itself. */
  attempt: () => Promise<RefreshAttemptResult>
  /** Re-fetches and stores a CSRF token. Returns it, or null when unavailable. */
  recoverCsrfToken: () => Promise<string | null>
  logout: () => Promise<void>
}

/**
 * Redeem the refresh token, treating a CSRF failure as recoverable rather than as
 * a sign-out.
 *
 * Measured in production 2026-08-30: a user was signed out at 10:00 KST and the
 * server log holds the exact sequence — `refresh_401 403 cause=csrf` followed
 * immediately by a logout call. The old code branched on
 * `status === 401 || status === 403` and called `performLogout()` for both.
 *
 * Those are different answers:
 *
 *   401  the server refused the identity. The session is over. Sign out.
 *   403  the CSRF handshake failed. This says nothing about the session, and for
 *        a shell user it is the EXPECTED first result — the shell signs in
 *        natively and bridges the session into the webview, so the web never
 *        receives the login response that carries `X-CSRFToken` and starts with
 *        no token at all.
 *
 * So 403 recovers the token from `/auth/csrf/` and retries once. If it still
 * fails, the session is HELD and reported as `unreachable`, which surfaces the
 * neutral retry state instead of destroying a session that was never revoked.
 * `useApi` already recovers this way for ordinary requests; only this path did not.
 */
export async function refreshWithCsrfRecovery(
  dependencies: RefreshRecoveryDependencies,
  options: AuthRefreshOptions = {},
): Promise<RefreshOutcome> {
  let result = await dependencies.attempt()

  if (result.status === 403) {
    const recovered = await dependencies.recoverCsrfToken()
    // Retrying with the same missing token would only reproduce the 403 and
    // spend another round trip to learn nothing.
    if (recovered) {
      result = await dependencies.attempt()
    }
  }

  if (result.status === 401) {
    if (options.logoutOnFailure ?? true) {
      await dependencies.logout()
    }
    return { ok: false, reason: 'rejected' }
  }

  // Still 403 after recovery, or recovery itself unavailable. Not a verdict on
  // the session — hold it and say so.
  if (result.status === 403) {
    return { ok: false, reason: 'unreachable' }
  }

  // Transport failure (offline, DNS, TLS, timeout) is reported as status 0.
  if (result.status === 0) {
    return { ok: false, reason: 'unreachable' }
  }

  if (!result.ok || !result.access) {
    return { ok: false, reason: 'rejected' }
  }

  return { ok: true }
}
