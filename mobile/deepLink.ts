/**
 * Safe deep-link handling for the native WebView bridge.
 *
 * `maeil1dok://` deep links can be triggered by any website the user visits or
 * any other installed app. The raw link path must never be interpolated into an
 * injected JavaScript string without validation and escaping, otherwise a
 * crafted link can break out of the string literal and execute arbitrary
 * JavaScript inside the authenticated web app origin (session theft / CSRF).
 *
 * Two independent defenses live here:
 *   1. `buildDeepLinkNavigationUrl` — deny-by-default origin validation so a
 *      link can only ever navigate within the web app origin.
 *   2. `buildLocationAssignmentScript` — JSON-encoded string literal so quotes
 *      in the (already origin-checked) URL cannot escape the injected script.
 */

/**
 * Resolve a `<scheme>://` deep link into a navigation URL that is guaranteed to
 * stay on the web app origin. Returns `null` when the link should be ignored.
 */
export const buildDeepLinkNavigationUrl = (
  rawUrl: unknown,
  webAppUrl: string,
  appScheme: string,
): string | null => {
  if (typeof rawUrl !== 'string') return null;

  const prefix = `${appScheme}://`;
  if (!rawUrl.startsWith(prefix)) return null;

  const remainder = rawUrl.slice(prefix.length);
  // Native code handles auth deep links itself; never forward them to the web view.
  if (remainder.startsWith('auth/')) return null;

  let base: URL;
  try {
    base = new URL(webAppUrl);
  } catch {
    return null;
  }

  // Strip leading slashes so protocol-relative ("//evil.com/x") and rooted
  // paths cannot escape the web app origin during resolution.
  const normalizedPath = remainder.replace(/^\/+/, '');

  let resolved: URL;
  try {
    resolved = new URL(normalizedPath, `${base.origin}/`);
  } catch {
    return null;
  }

  // Deny-by-default: absolute URLs embedded in the path resolve to their own
  // origin and are rejected here.
  if (resolved.origin !== base.origin) return null;

  // Only http(s) navigation is ever allowed (guards against javascript:, data:, etc.).
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;

  return resolved.toString();
};

/**
 * Build the injected script that navigates the WebView to `targetUrl`.
 * `JSON.stringify` produces a properly escaped JS string literal so no character
 * in the URL can break out of the assignment.
 */
export const buildLocationAssignmentScript = (targetUrl: string): string =>
  `window.location.href = ${JSON.stringify(targetUrl)}; true;`;
