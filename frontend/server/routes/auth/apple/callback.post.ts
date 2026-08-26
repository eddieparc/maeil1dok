import { getNativeAppScheme } from '#shared/utils/authCallbackRuntime'

// Apple Sign In uses form_post response mode, so we need a server-side handler
// This receives POST data and redirects to the client-side callback page with query params

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
  const safeScheme = getNativeAppScheme(stateData)
  if (safeScheme) {
    const deepLink = `${safeScheme}://auth/apple/callback?${params.toString()}`
    return sendRedirect(event, deepLink, 302)
  }
  
  // Otherwise redirect to client-side callback page
  const callbackUrl = `/auth/apple/callback?${params.toString()}`
  return sendRedirect(event, callbackUrl, 302)
})
