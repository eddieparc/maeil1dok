const PROVIDER_LABELS = {
  kakao: '카카오',
  google: 'Google',
  apple: 'Apple',
}

export const getProviderDisplayName = provider =>
  Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, provider)
    ? PROVIDER_LABELS[provider]
    : provider

export const buildDeleteAccountPayload = password => ({
  password,
  confirm_delete: true,
})

export const buildOAuthLinkUrl = (provider, providerConfig, state) => {
  if (!providerConfig.clientId || !providerConfig.redirectUri) {
    throw new Error('OAuth provider configuration is incomplete.')
  }

  const authUrl = new URL(providerConfig.baseUrl)
  authUrl.searchParams.set('client_id', providerConfig.clientId)
  authUrl.searchParams.set('redirect_uri', providerConfig.redirectUri)
  authUrl.searchParams.set('state', state)

  if (provider === 'apple') {
    authUrl.searchParams.set('response_type', 'code id_token')
    authUrl.searchParams.set('response_mode', 'form_post')
  } else {
    authUrl.searchParams.set('response_type', 'code')
  }

  if (providerConfig.scope) authUrl.searchParams.set('scope', providerConfig.scope)

  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
  }

  return authUrl.toString()
}

export const mergeEmailUpdateIntoAuthUser = (currentUser, response, fallbackEmail) => ({
  ...currentUser,
  email: response.email || fallbackEmail,
  email_verified: typeof response.email_verified === 'boolean'
    ? response.email_verified
    : currentUser.email_verified,
})

export const buildPasswordMergePayload = form => ({
  merge_type: 'password',
  target_identifier: form.targetIdentifier,
  target_password: form.targetPassword,
  keep_account: form.keepAccount,
})

export const buildNotificationSettingsPayload = settings => ({
  daily_reading_reminder: settings.daily_reading_reminder,
  weekly_progress_summary: settings.weekly_progress_summary,
  service_notice: settings.service_notice,
  reminder_time: settings.reminder_time,
})

export const buildSocialMergePayload = (mergeInfo, keepAccount) => ({
  provider: mergeInfo.provider,
  code: mergeInfo.code,
  keep_account: keepAccount,
  ...(mergeInfo.merge_token ? { merge_token: mergeInfo.merge_token } : {}),
  ...(mergeInfo.id_token ? { id_token: mergeInfo.id_token } : {}),
})

export const shouldUseNativeAppleLink = (provider, isNativeApp) =>
  provider === 'apple' && isNativeApp === true

export const buildNativeAppleLinkRequest = state => {
  if (typeof state !== 'string' || !state || state.length > 4096) {
    throw new Error('Invalid native Apple link state.')
  }
  return {
    type: 'auth:apple:link',
    data: { state },
  }
}

export const parseNativeAppleLinkResult = message => {
  if (typeof message !== 'object' || message === null) return null
  if (message.type !== 'auth:apple:link:result') return null
  const data = message.data
  if (typeof data !== 'object' || data === null) return null
  if (typeof data.state !== 'string' || !data.state || data.state.length > 4096) return null
  if (data.error === 'cancelled' || data.error === 'unavailable') {
    return { state: data.state, error: data.error }
  }
  if (typeof data.idToken !== 'string' || !data.idToken) return null
  return {
    state: data.state,
    idToken: data.idToken,
    code: typeof data.code === 'string' ? data.code : '',
  }
}
