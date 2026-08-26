const ALLOWED_APP_SCHEMES = new Set(['maeil1dok', 'maeil1dok-dev'])
const SIGNED_LINK_STATE_PATTERN = /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/

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

export function buildLinkSocialPayload(
  provider: string,
  code: string,
  state: string,
  idToken?: string,
): Record<string, string> {
  const payload: Record<string, string> = { provider, code, state }
  if (provider === 'apple' && idToken) {
    payload.id_token = idToken
  }
  return payload
}

export function getMergeToken(errorData: Record<string, unknown>): string | undefined {
  return typeof errorData.merge_token === 'string' && errorData.merge_token
    ? errorData.merge_token
    : undefined
}
