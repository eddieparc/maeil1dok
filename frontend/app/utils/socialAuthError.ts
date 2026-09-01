export type SocialAuthRecoveryAction =
  | 'contact_support'
  | 'restart_social_login'
  | 'retry'

export type SocialAuthErrorView = {
  readonly title: string
  readonly message: string
  readonly errorCode: string
  readonly requestId: string
  readonly action: SocialAuthRecoveryAction
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

const errorData = (error: unknown): Record<string, unknown> => {
  if (typeof error !== 'object' || error === null) return {}
  const record = error as Record<string, unknown>
  return typeof record.data === 'object' && record.data !== null
    ? record.data as Record<string, unknown>
    : record
}

export const resolveSocialAuthError = (
  error: unknown,
): SocialAuthErrorView => {
  const data = errorData(error)
  const backendMessage = typeof data.error === 'string' && data.error.trim()
    ? data.error.trim()
    : '소셜 로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  const errorCode = typeof data.error_code === 'string'
    ? data.error_code
    : 'social_login_failed'
  const requestId = typeof data.request_id === 'string'
    && SAFE_REQUEST_ID.test(data.request_id)
    ? data.request_id
    : ''
  const rawAction = data.action
  const action: SocialAuthRecoveryAction = rawAction === 'restart_social_login'
    ? 'restart_social_login'
    : rawAction === 'contact_support'
      ? 'contact_support'
      : 'retry'

  return {
    title: action === 'restart_social_login'
      ? '소셜 로그인을 다시 진행해 주세요'
      : '소셜 로그인을 완료하지 못했습니다',
    message: requestId
      ? `${backendMessage}\n오류 ID: ${requestId}`
      : backendMessage,
    errorCode,
    requestId,
    action,
  }
}
