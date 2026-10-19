/**
 * 계정 설정 페이지에서 쓰는 도메인 타입.
 * pages/account/settings.vue 와 composables/account-settings/* 가 공유한다.
 */

export type Provider = 'kakao' | 'google' | 'apple'
export type KeepAccount = 'current' | 'other'

export const PROVIDERS: Provider[] = ['kakao', 'google', 'apple']

export interface LinkedAccount {
  provider: Provider
  provider_display: string
  email: string | null
  profile_image: string | null
  linked_at: string
  can_unlink: boolean
}

export interface AuthMethods {
  total: number
  password: boolean
  social_count: number
  providers: Provider[]
  can_remove_login_method: boolean
}

export interface LinkedAccountsResponse {
  has_password: boolean
  email: string | null
  primary_email?: string | null
  auth_methods?: AuthMethods
  linked_accounts: LinkedAccount[]
}

export interface MergeAccountSummary {
  id: number
  nickname: string
  email: string | null
  profile_image: string | null
  providers: Provider[]
  has_password: boolean
  created_at: string
}

export interface MergeInfo {
  provider: Provider
  code: string
  merge_token?: string
  id_token?: string
  current_account: MergeAccountSummary
  other_account: MergeAccountSummary
}

export interface NativeWindow extends Window {
  isReactNativeWebView?: boolean
  ReactNativeWebView?: {
    postMessage(message: string): void
  }
}
