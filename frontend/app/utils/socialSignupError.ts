export type SocialSignupRecoveryAction =
  | 'choose_another_nickname'
  | 'restart_social_login'
  | 'retry'

export type SocialSignupErrorView = {
  readonly title: string
  readonly message: string
  readonly action: SocialSignupRecoveryAction
  readonly field?: string
  readonly requestId: string
}

type ErrorPayload = {
  readonly error?: unknown
  readonly error_code?: unknown
  readonly request_id?: unknown
  readonly field?: unknown
  readonly action?: unknown
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

const readPayload = (error: unknown): ErrorPayload => {
  if (typeof error !== 'object' || error === null) return {}
  const record = error as Record<string, unknown>
  const data = record.data
  if (typeof data === 'object' && data !== null) {
    return data as ErrorPayload
  }
  return record as ErrorPayload
}

export const resolveSocialSignupError = (
  error: unknown,
): SocialSignupErrorView => {
  const payload = readPayload(error)
  const errorCode = typeof payload.error_code === 'string'
    ? payload.error_code
    : ''
  const backendMessage = typeof payload.error === 'string'
    ? payload.error.trim()
    : ''
  const requestId = typeof payload.request_id === 'string'
    && SAFE_REQUEST_ID.test(payload.request_id)
    ? payload.request_id
    : ''
  const requestSuffix = requestId ? `\n오류 ID: ${requestId}` : ''

  if (
    errorCode === 'signup_session_expired'
    || errorCode === 'signup_session_missing'
    || payload.action === 'restart_social_login'
  ) {
    return {
      title: '가입 인증 시간이 만료되었습니다',
      message: `${backendMessage || '소셜 로그인부터 다시 진행해 주세요.'}${requestSuffix}`,
      action: 'restart_social_login',
      requestId,
    }
  }

  if (
    errorCode === 'nickname_taken'
    || payload.action === 'choose_another_nickname'
  ) {
    return {
      title: '닉네임을 사용할 수 없습니다',
      message: backendMessage || '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
      action: 'choose_another_nickname',
      field: typeof payload.field === 'string' ? payload.field : 'nickname',
      requestId,
    }
  }

  if (backendMessage) {
    return {
      title: '회원가입을 완료하지 못했습니다',
      message: `${backendMessage}${requestSuffix}`,
      action: 'retry',
      field: typeof payload.field === 'string' ? payload.field : undefined,
      requestId,
    }
  }

  return {
    title: '네트워크 연결을 확인해 주세요',
    message: '회원가입 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
    action: 'retry',
    requestId: '',
  }
}
