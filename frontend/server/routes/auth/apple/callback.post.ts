import { buildAppleCallbackForward } from '#shared/utils/authCallbackRuntime'

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
  
  return sendRedirect(
    event,
    buildAppleCallbackForward({ code, id_token, state, user }, stateData),
    302,
  )
})
