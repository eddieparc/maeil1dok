export const isAuthEmailFormat = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
export const hasAuthLetterAndNumber = (value: string) => /\p{L}/u.test(value) && /\p{N}/u.test(value)
export const isAuthPasswordValid = (value: string) => value.length >= 8 && hasAuthLetterAndNumber(value)
export function authPasswordStrength(value: string): 0 | 1 | 2 | 3 {
  if (!value) return 0
  if (!isAuthPasswordValid(value)) return 1
  return value.length >= 12 && /[^\p{L}\p{N}]/u.test(value) ? 3 : 2
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
export function authErrorData(error: unknown) {
  const source = record(error)
  return record(source.data ?? record(source.response).data)
}
export function authErrorCode(error: unknown): string {
  const data = authErrorData(error)
  const code = data.error_code ?? data.code
  return typeof code === 'string' ? code : ''
}
export function authErrorMessage(error: unknown, fallback: string): string {
  const data = authErrorData(error)
  for (const key of ['error', 'detail', 'new_password']) {
    const value = data[key]
    if (typeof value === 'string') return value
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  }
  return fallback
}
/** Existing reset endpoints have legacy Korean errors, not a guaranteed code field. */
export function isRejectedResetToken(error: unknown): boolean {
  const data = authErrorData(error)
  if (data.valid === false) return true
  if (['token_expired', 'invalid_token', 'token_used'].includes(authErrorCode(error))) return true
  return typeof data.error === 'string' && (
    data.error === '유효하지 않은 링크입니다.' || data.error.startsWith('링크가 만료되었습니다.')
  )
}

/** Optional proposals, never assigned identities or claims of server availability. */
export function authNicknameSuggestions(suggestion: string): string[] {
  const base = suggestion.trim().slice(0, 16)
  return base.length >= 2 ? [base, `${base}통독`, `${base}말씀`] : ['말씀산책', '매일한장', '통독새싹']
}
