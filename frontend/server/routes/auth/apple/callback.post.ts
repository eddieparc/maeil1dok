// Apple Sign In uses form_post response mode, so we need a server-side handler
// This receives POST data and redirects to the client-side callback page with query params
const ALLOWED_APP_SCHEMES = new Set(['maeil1dok', 'maeil1dok-dev'])

const getSafeAppScheme = (scheme: unknown) => {
  if (typeof scheme !== 'string') return ''
  if (!ALLOWED_APP_SCHEMES.has(scheme)) return ''
  return scheme
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Apple sends: code, id_token, state, user (JSON string, only on first login)
  const { code, id_token, state, user } = body
  
  // Parse state to check if it's from app or link action
  let stateData: { from?: string; scheme?: string; action?: string } | null = null
  if (state) {
    try {
      stateData = JSON.parse(decodeURIComponent(state))
    } catch {
      // Invalid state, continue without it
    }
  }
  
  // Build query params for client-side handling
  const params = new URLSearchParams()
  
  if (code) {
    params.set('code', code)
  }
  if (id_token) {
    params.set('id_token', id_token)
  }
  if (state) {
    params.set('state', state)
  }
  if (user) {
    // Apple sends user info as JSON string on first login
    params.set('user', user)
  }
  
  // If from app, redirect to deep link
  const safeScheme = getSafeAppScheme(stateData?.scheme)
  if (stateData?.from === 'app' && safeScheme) {
    const deepLink = `${safeScheme}://auth/apple/callback?${params.toString()}`
    return sendRedirect(event, deepLink, 302)
  }
  
  // Otherwise redirect to client-side callback page
  const callbackUrl = `/auth/apple/callback?${params.toString()}`
  return sendRedirect(event, callbackUrl, 302)
})
