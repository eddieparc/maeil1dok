/**
 * 계정 설정 API 응답 정규화 + 에러 메시지 추출.
 * pages/account/settings.vue 에 있던 로컬 구현을 그대로 옮긴 것이다.
 * (공용 utils/typeGuards.ts 는 isRecord 가 배열을 제외해 의미가 다르므로
 *  이 페이지의 원래 동작을 유지하는 로컬 구현을 유지한다.)
 */
import { getProviderDisplayName } from '~/utils/accountSettingsRuntime.js'
import type {
  AuthMethods,
  LinkedAccount,
  LinkedAccountsResponse,
  MergeAccountSummary,
  MergeInfo,
  Provider,
} from './types'

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const getString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

export const getBoolean = (record: Record<string, unknown>, key: string) => {
  return record[key] === true
}

export const getNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'number' ? value : 0
}

export const isProvider = (provider: string): provider is Provider => {
  return provider === 'kakao' || provider === 'google' || provider === 'apple'
}

export const parseProvider = (value: unknown): Provider | null => {
  return typeof value === 'string' && isProvider(value) ? value : null
}

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (!isRecord(error)) return fallback
  const data = error.data
  if (isRecord(data)) {
    return getString(data, 'error') || getString(data, 'detail') || getString(data, 'message') || fallback
  }
  return getString(error, 'message') || fallback
}

export const getErrorPayload = (error: unknown): Record<string, unknown> | null => {
  if (!isRecord(error)) return null
  return isRecord(error.data) ? error.data : error
}

export const normalizeLinkedAccounts = (payload: unknown): LinkedAccountsResponse => {
  if (!isRecord(payload)) {
    return {
      has_password: false,
      email: null,
      primary_email: null,
      linked_accounts: [],
    }
  }
  const accountItems = Array.isArray(payload.linked_accounts) ? payload.linked_accounts : []
  const authMethodsPayload = isRecord(payload.auth_methods) ? payload.auth_methods : null
  const linked_accounts = accountItems.flatMap((item): LinkedAccount[] => {
    if (!isRecord(item)) return []
    const provider = parseProvider(item.provider)
    if (!provider) return []
    return [{
      provider,
      provider_display: getString(item, 'provider_display') || getProviderDisplayName(provider),
      email: getString(item, 'email'),
      profile_image: getString(item, 'profile_image'),
      linked_at: getString(item, 'linked_at') || '',
      can_unlink: getBoolean(item, 'can_unlink'),
    }]
  })

  const auth_methods: AuthMethods | undefined = authMethodsPayload
    ? {
        total: getNumber(authMethodsPayload, 'total'),
        password: getBoolean(authMethodsPayload, 'password'),
        social_count: getNumber(authMethodsPayload, 'social_count'),
        providers: Array.isArray(authMethodsPayload.providers)
          ? authMethodsPayload.providers.flatMap((provider): Provider[] => {
              const parsedProvider = parseProvider(provider)
              return parsedProvider ? [parsedProvider] : []
            })
          : [],
        can_remove_login_method: getBoolean(authMethodsPayload, 'can_remove_login_method'),
      }
    : undefined

  return {
    has_password: getBoolean(payload, 'has_password'),
    email: getString(payload, 'email') || getString(payload, 'primary_email'),
    primary_email: getString(payload, 'primary_email') || getString(payload, 'email'),
    auth_methods,
    linked_accounts,
  }
}

export const normalizeMergeAccountSummary = (payload: unknown): MergeAccountSummary | null => {
  if (!isRecord(payload)) return null
  const providerItems = Array.isArray(payload.providers) ? payload.providers : []
  return {
    id: getNumber(payload, 'id'),
    nickname: getString(payload, 'nickname') || '',
    email: getString(payload, 'email'),
    profile_image: getString(payload, 'profile_image'),
    providers: providerItems.flatMap((provider): Provider[] => {
      const parsedProvider = parseProvider(provider)
      return parsedProvider ? [parsedProvider] : []
    }),
    has_password: getBoolean(payload, 'has_password'),
    created_at: getString(payload, 'created_at') || '',
  }
}

export const normalizeMergeInfo = (payload: unknown): MergeInfo | null => {
  if (!isRecord(payload)) return null
  const provider = parseProvider(payload.provider)
  const code = getString(payload, 'code')
  const idToken = getString(payload, 'id_token')
  const currentAccount = normalizeMergeAccountSummary(payload.current_account)
  const otherAccount = normalizeMergeAccountSummary(payload.other_account)
  const hasCredential = Boolean(code) || (provider === 'apple' && Boolean(idToken))
  if (!provider || !hasCredential || !currentAccount || !otherAccount) return null
  return {
    provider,
    code: code || '',
    merge_token: getString(payload, 'merge_token') || undefined,
    id_token: idToken || undefined,
    current_account: currentAccount,
    other_account: otherAccount,
  }
}
