export type AccountProvider = 'kakao' | 'google' | 'apple'
export type AccountKeepChoice = 'current' | 'other'

export interface OAuthProviderConfig {
  clientId?: string | null
  redirectUri?: string | null
  baseUrl: string
  scope?: string | null
}

export interface EmailUpdateResult {
  email?: string | null
  email_verified?: boolean
}

export interface AuthEmailState {
  email?: string | null
  email_verified?: boolean
}

export interface PasswordMergeFormState {
  targetIdentifier: string
  targetPassword: string
  keepAccount: AccountKeepChoice
}

export interface NotificationSettingsState {
  daily_reading_reminder: boolean
  weekly_progress_summary: boolean
  service_notice: boolean
  reminder_time: string
}

export interface SocialMergeInfoState {
  provider: AccountProvider
  code: string
  id_token?: string
  merge_token?: string
}
