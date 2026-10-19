const ALLOWED_APP_SCHEMES = new Set(['maeil1dok', 'maeil1dok-dev'])
const SIGNED_LINK_STATE_PATTERN = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/
const WEB_CALLBACK_ORIGINS = new Set([
  'https://maeil1dok.app',
  'https://beta.maeil1dok.app',
])
const CALLBACK_PATHS = {
  apple: '/auth/apple/callback',
  google: '/auth/google/callback',
  kakao: '/auth/kakao/callback',
} as const

type SocialProvider = keyof typeof CALLBACK_PATHS

export function firstQueryValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

export function isSignedLinkState(state: string): boolean {
  return SIGNED_LINK_STATE_PATTERN.test(state)
}

export function getSafeAppScheme(scheme: unknown): string {
  if (typeof scheme !== 'string') return ''
  return ALLOWED_APP_SCHEMES.has(scheme) ? scheme : ''
}

export interface NativeAppState {
  from?: unknown
  scheme?: unknown
}

export function getNativeAppScheme(state: NativeAppState | null | undefined): string {
  if (state?.from !== 'app') return ''
  return getSafeAppScheme(state.scheme)
}

export function resolveSocialRedirectUri(
  provider: string,
  configuredRedirectUri: unknown,
  currentOrigin: string,
): string {
  if (!Object.prototype.hasOwnProperty.call(CALLBACK_PATHS, provider)) return ''
  const callbackPath = CALLBACK_PATHS[provider as SocialProvider]
  if (WEB_CALLBACK_ORIGINS.has(currentOrigin)) {
    return `${currentOrigin}${callbackPath}`
  }
  return typeof configuredRedirectUri === 'string' ? configuredRedirectUri : ''
}

export function buildLinkSocialPayload(
  provider: string,
  code: string,
  callback: {
    readonly state: string
    readonly idToken?: string
    readonly redirectUri?: string
  },
): Record<string, string> {
  const payload: Record<string, string> = {
    provider,
    code,
    state: callback.state,
  }
  if (callback.redirectUri) {
    payload.redirect_uri = callback.redirectUri
  }
  if (provider === 'apple' && callback.idToken) {
    payload.id_token = callback.idToken
  }
  return payload
}

export function buildAppleCallbackForward(
  body: Record<string, unknown>,
  stateData?: NativeAppState | null,
): string {
  const params = new URLSearchParams()
  for (const key of ['code', 'id_token', 'state', 'user'] as const) {
    const value = body[key]
    if (typeof value === 'string' && value) params.set(key, value)
  }
  const query = params.toString()
  const safeScheme = getNativeAppScheme(stateData)
  const callback = safeScheme
    ? `${safeScheme}://auth/apple/callback`
    : '/auth/apple/callback'
  return query ? `${callback}?${query}` : callback
}

export function getMergeToken(errorData: Record<string, unknown>): string | undefined {
  return typeof errorData.merge_token === 'string' && errorData.merge_token
    ? errorData.merge_token
    : undefined
}
