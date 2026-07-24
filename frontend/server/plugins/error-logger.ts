const SENSITIVE_LOG_QUERY_KEYS = new Set([
  'access',
  'access_token',
  'refresh',
  'refresh_token',
  'id_token',
  'token',
  'code',
  'signup_token',
  'state',
  'email',
  'provider_id',
  'profile_image',
  'suggested_nickname',
])

const SENSITIVE_LOG_KEY_ALTERNATION = Array.from(SENSITIVE_LOG_QUERY_KEYS)
  .sort((a, b) => b.length - a.length)
  .join('|')

const SENSITIVE_LOG_QUERY_PATTERN = new RegExp(
  `([?&#;](?:${SENSITIVE_LOG_KEY_ALTERNATION})=)[^&#;]*`,
  'gi',
)

const redactSensitiveParameters = (value: string): string =>
  value.replace(SENSITIVE_LOG_QUERY_PATTERN, '$1[redacted]')

export const redactSensitiveUrl = (rawUrl?: string | null): string => {
  if (!rawUrl) return 'unknown'

  const isRelative = rawUrl.startsWith('/')

  try {
    const parsed = new URL(rawUrl, 'https://maeil1dok.local')
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_LOG_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[redacted]')
      }
    }
    parsed.hash = redactSensitiveParameters(parsed.hash)
    if (isRelative) {
      return parsed.pathname + parsed.search + parsed.hash
    }
    return parsed.toString()
  } catch {
    return redactSensitiveParameters(rawUrl)
  }
}

export const redactSensitiveText = (value?: unknown): string => {
  return redactSensitiveParameters(String(value ?? ''))
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', async (error, { event }) => {
    const url = redactSensitiveUrl(event?.node?.req?.url)
    const method = event?.node?.req?.method || 'unknown'
    const userAgent = event?.node?.req?.headers?.['user-agent'] || 'unknown'
    const cookies = event?.node?.req?.headers?.cookie || 'none'

    console.error('========== SSR ERROR ==========')
    console.error('URL:', url)
    console.error('Method:', method)
    console.error('User-Agent:', userAgent)
    console.error('Has Cookies:', cookies !== 'none' ? 'YES' : 'NO')
    console.error('Error Name:', error?.name)
    console.error('Error Message:', redactSensitiveText(error?.message))
    console.error('Error Stack:', redactSensitiveText(error?.stack))
    console.error('===============================')
  })

  nitroApp.hooks.hook('request', async (event) => {
    const url = event?.node?.req?.url || 'unknown'
    const cookies = event?.node?.req?.headers?.cookie || 'none'
    const hasAuthCookie = cookies.includes('access_token')

    if (hasAuthCookie) {
      console.log('[SSR Request] URL:', redactSensitiveUrl(url), '| Has Auth Cookie: YES')
    }
  })
})
