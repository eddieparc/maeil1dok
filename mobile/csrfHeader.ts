/**
 * Carry the CSRF token on the shell's own API calls.
 *
 * The server runs a CSRF check on `/auth/token/refresh/` and `/auth/logout/`
 * whenever the refresh cookie is present. The shell's native `fetch` sends no
 * `Origin` and no `Referer`, so Django's check can never pass for it -- and
 * `sharedCookiesEnabled` + `credentials: 'include'` guarantees the cookie IS
 * present. Measured 2026-08-30: every such call was answered 403.
 *
 * Refresh was fixed on the server (a token presented in the body is proof of
 * possession, so it is not a CSRF). Logout has no body token, so the only way for
 * the shell to log out on the SERVER is to send the token from the shared cookie
 * store. Without it the refresh token is never blacklisted and the sign-out does
 * not stick.
 *
 * Pure on purpose: `CookieManager.get()` runs at the call site and its result is
 * passed in, so the rule is testable without a device.
 */

export const CSRF_COOKIE_NAME = 'csrftoken';
export const CSRF_HEADER_NAME = 'X-CSRFToken';

function readCookieValue(entry: unknown): string | null {
  // The bindings have returned both shapes across versions.
  if (typeof entry === 'string') return entry.length > 0 ? entry : null;
  if (entry && typeof entry === 'object') {
    const value = (entry as { value?: unknown }).value;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

export function csrfHeadersFrom(cookies: unknown): Record<string, string> {
  if (!cookies || typeof cookies !== 'object' || Array.isArray(cookies)) return {};

  const token = readCookieValue((cookies as Record<string, unknown>)[CSRF_COOKIE_NAME]);
  // No header at all when there is no token. An empty header is worse than none:
  // Django compares it and rejects, turning "not configured" into a hard failure.
  return token ? { [CSRF_HEADER_NAME]: token } : {};
}
