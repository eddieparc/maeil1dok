const DEFAULT_CSRF_COOKIE = 'csrftoken'

export function readExactCookie(cookies: string, name: string): string | null {
  for (const cookie of cookies.split(';')) {
    const separator = cookie.indexOf('=')
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue
    return cookie.slice(separator + 1).trim() || null
  }
  return null
}

function storageKey(cookieName: string): string {
  // Keep primary's storage contract, but never reuse the former beta site's
  // production-backed token after the same hostname moves to isolated cookies.
  return cookieName === DEFAULT_CSRF_COOKIE ? 'csrfToken' : `csrfToken:${cookieName}`
}

export function readCsrfToken(cookieName = DEFAULT_CSRF_COOKIE): string | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(storageKey(cookieName))
  return stored || readExactCookie(document.cookie, cookieName)
}

export function storeCsrfToken(token: string, cookieName = DEFAULT_CSRF_COOKIE): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey(cookieName), token)
  }
}
