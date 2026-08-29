/**
 * Involuntary re-auth marker — a SECONDARY signal, never the north star.
 *
 * The north star lives in the server counters (`authmetrics`), which see every
 * client. This marker only sees browsers that came back, so it systematically
 * under-counts the users hurt worst: the ones who gave up. Read it as a
 * corroborating shape, never as the rollback trigger.
 *
 * The rule it encodes: a browser that was authenticated at some point and then
 * lands on the login screen WITHOUT having asked to sign out has been signed out
 * against its will. Voluntary logout clears the marker, so the ordinary
 * sign-out -> login-screen path produces no signal.
 */

export const REAUTH_MARKER_KEY = 'auth:was-authenticated';

/**
 * Beyond this age the marker no longer proves anything. A month-old marker on a
 * browser that simply expired its session is normal attrition, not a defect, and
 * counting it would drown the signal we actually want.
 */
export const REAUTH_MARKER_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type ReauthMarker = { readonly at: number };

export function createReauthMarker(now: number): ReauthMarker {
  return { at: now };
}

export function parseReauthMarker(raw: string | null | undefined): ReauthMarker | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const at = (parsed as { at?: unknown }).at;
    return typeof at === 'number' && Number.isFinite(at) ? { at } : null;
  } catch {
    return null;
  }
}

export type InvoluntaryReauthInput = {
  readonly marker: ReauthMarker | null;
  readonly landedOnLogin: boolean;
  readonly voluntaryLogout: boolean;
  readonly now: number;
};

export function shouldReportInvoluntaryReauth(input: InvoluntaryReauthInput): boolean {
  if (!input.landedOnLogin) return false;
  // Asserted independently of the marker being cleared: a clear that loses the
  // race must not manufacture a signal out of a user's own sign-out.
  if (input.voluntaryLogout) return false;
  if (!input.marker) return false;
  return input.now - input.marker.at <= REAUTH_MARKER_MAX_AGE_MS;
}

export type AuthRenderOutcome = 'hit' | 'miss' | 'anon';

export function classifyAuthRender(input: {
  readonly hadAuthCookie: boolean;
  readonly resolvedUser: boolean;
}): AuthRenderOutcome {
  if (input.resolvedUser) return 'hit';
  return input.hadAuthCookie ? 'miss' : 'anon';
}
