<!-- noqa: SIZE_OK account settings is the route-level account-management surface; this keeps closely coupled credential, provider, merge, notification, and danger-zone flows in one authenticated page. -->
<template>
  <div class="settings-page">
    <PageHeader title="계정 설정" fallback-path="/" />

    <main class="settings-shell">
      <section class="settings-section">
        <h2 class="section-title">프로필</h2>
        <div class="profile-summary">
          <div class="profile-avatar">
            <NuxtImg v-if="user?.profile_image" :src="user.profile_image" :alt="user.nickname" loading="lazy" />
            <div v-else class="avatar-placeholder">{{ user?.nickname?.charAt(0) || '?' }}</div>
          </div>
          <div class="profile-copy">
            <strong>{{ user?.nickname || '사용자' }}</strong>
            <span>{{ linkedAccounts?.email || user?.email || '이메일 없음' }}</span>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">이메일</h2>
        <div class="section-content">
          <div class="setting-item">
            <div class="setting-info">
              <p class="setting-label">로그인 이메일</p>
              <p class="setting-description">{{ linkedAccounts?.email || user?.email || '등록된 이메일 없음' }}</p>
            </div>
            <button class="action-button" type="button" @click="showEmailPanel = !showEmailPanel">
              {{ showEmailPanel ? '닫기' : '수정' }}
            </button>
          </div>
          <form v-if="showEmailPanel" class="inline-form" @submit.prevent="handleUpdateEmail">
            <label class="input-wrapper" for="account-email">
              <span>새 이메일</span>
              <input id="account-email" v-model.trim="emailForm.email" type="email" autocomplete="email" placeholder="name@example.com">
            </label>
            <label v-if="linkedAccounts?.has_password" class="input-wrapper" for="email-password">
              <span>현재 비밀번호</span>
              <input id="email-password" v-model="emailForm.currentPassword" type="password" autocomplete="current-password">
            </label>
            <p v-if="emailError" class="error-text">{{ emailError }}</p>
            <div class="inline-actions">
              <button class="action-button" type="button" @click="resetEmailPanel">취소</button>
              <button class="action-button primary" type="submit" :disabled="emailLoading">
                {{ emailLoading ? '저장 중...' : '저장' }}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section v-if="user?.email && user?.has_usable_password_flag && !user?.email_verified" class="settings-section">
        <h2 class="section-title">이메일 인증</h2>
        <div class="section-content">
          <div class="setting-item">
            <div class="setting-info">
              <p class="setting-label">인증 필요</p>
              <p class="setting-description">{{ user.email }}</p>
            </div>
            <button class="action-button primary" type="button" :disabled="resendingEmail || emailCooldown > 0" @click="handleResendVerification">
              {{ emailButtonText }}
            </button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">비밀번호</h2>
        <div class="section-content">
          <div class="setting-item">
            <div class="setting-info">
              <p class="setting-label">비밀번호</p>
              <p class="setting-description">{{ linkedAccounts?.has_password ? '설정됨' : '미설정' }}</p>
            </div>
            <button class="action-button" type="button" @click="showPasswordPanel = !showPasswordPanel">
              {{ showPasswordPanel ? '닫기' : (linkedAccounts?.has_password ? '변경' : '설정') }}
            </button>
          </div>
          <form v-if="showPasswordPanel" class="inline-form" @submit.prevent="handleSetPassword">
            <label v-if="linkedAccounts?.has_password" class="input-wrapper" for="current-password">
              <span>현재 비밀번호</span>
              <input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password">
            </label>
            <label class="input-wrapper" for="new-password">
              <span>새 비밀번호</span>
              <input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" placeholder="8자 이상">
            </label>
            <label class="input-wrapper" for="new-password-confirm">
              <span>비밀번호 확인</span>
              <input id="new-password-confirm" v-model="newPasswordConfirm" type="password" autocomplete="new-password">
            </label>
            <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
            <div class="inline-actions">
              <button class="action-button" type="button" @click="resetPasswordPanel">취소</button>
              <button class="action-button primary" type="submit" :disabled="passwordLoading">
                {{ passwordLoading ? '저장 중...' : '저장' }}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">연결된 계정</h2>
        <div class="section-content">
          <SkeletonList v-if="loading" :count="3" variant="user" />
          <template v-else>
            <div v-for="provider in PROVIDERS" :key="provider" class="setting-item">
              <div class="setting-info">
                <div class="provider-badge">
                  <span class="provider-icon" :class="provider">{{ getProviderDisplayName(provider).charAt(0) }}</span>
                  <p class="setting-label">{{ getProviderDisplayName(provider) }}</p>
                </div>
                <p class="setting-description">{{ getLinkedAccount(provider)?.email || (isProviderLinked(provider) ? '연결됨' : '연결되지 않음') }}</p>
              </div>
              <button
                v-if="isProviderLinked(provider)"
                class="action-button danger"
                type="button"
                :disabled="!canUnlink(provider)"
                @click="handleUnlink(provider)"
              >
                연결 해제
              </button>
              <button
                v-else
                class="action-button primary"
                type="button"
                :disabled="linkingProvider === provider"
                @click="handleLinkProvider(provider)"
              >
                {{ linkingProvider === provider ? '이동 중...' : '연결' }}
              </button>
            </div>
          </template>
        </div>
        <p class="section-note">최소 하나의 로그인 방법이 필요합니다.</p>
      </section>

      <section class="settings-section">
        <h2 class="section-title">기존 계정 병합</h2>
        <div class="section-content">
          <form class="inline-form" @submit.prevent="handlePasswordMerge">
            <label class="input-wrapper" for="merge-id">
              <span>아이디 또는 이메일</span>
              <input id="merge-id" v-model.trim="passwordMergeForm.targetIdentifier" type="text" autocomplete="username">
            </label>
            <label class="input-wrapper" for="merge-password">
              <span>대상 계정 비밀번호</span>
              <input id="merge-password" v-model="passwordMergeForm.targetPassword" type="password" autocomplete="current-password">
            </label>
            <label class="input-wrapper" for="merge-keep">
              <span>유지할 계정</span>
              <select id="merge-keep" v-model="passwordMergeForm.keepAccount">
                <option value="current">현재 로그인 계정</option>
                <option value="other">입력한 기존 계정</option>
              </select>
            </label>
            <p v-if="passwordMergeError" class="error-text">{{ passwordMergeError }}</p>
            <div class="inline-actions">
              <button class="action-button primary" type="submit" :disabled="passwordMergeLoading">
                {{ passwordMergeLoading ? '병합 중...' : '병합' }}
              </button>
            </div>
          </form>
        </div>
        <p class="section-note">병합하지 않은 계정은 30일 후 삭제됩니다.</p>
      </section>

      <section class="settings-section">
        <h2 class="section-title">알림 설정</h2>
        <div class="section-content">
          <label class="setting-item switch-row">
            <span class="setting-info">
              <span class="setting-label">매일 읽기 알림</span>
              <span class="setting-description">설정한 시간에 받기</span>
            </span>
            <input v-model="notificationSettings.daily_reading_reminder" type="checkbox">
          </label>
          <div class="setting-item">
            <label class="input-wrapper compact" for="reminder-time">
              <span>알림 시간</span>
              <input id="reminder-time" v-model="notificationSettings.reminder_time" type="time">
            </label>
          </div>
          <label class="setting-item switch-row">
            <span class="setting-info">
              <span class="setting-label">주간 진행 요약</span>
              <span class="setting-description">주간 리포트 받기</span>
            </span>
            <input v-model="notificationSettings.weekly_progress_summary" type="checkbox">
          </label>
          <label class="setting-item switch-row">
            <span class="setting-info">
              <span class="setting-label">서비스 공지</span>
              <span class="setting-description">중요 공지 받기</span>
            </span>
            <input v-model="notificationSettings.service_notice" type="checkbox">
          </label>
          <div class="setting-item align-end">
            <button class="action-button primary" type="button" :disabled="notificationLoading" @click="saveNotificationSettings">
              {{ notificationLoading ? '저장 중...' : '저장' }}
            </button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">세션</h2>
        <div class="section-content">
          <div class="setting-item">
            <div class="setting-info">
              <p class="setting-label">로그아웃</p>
              <p class="setting-description">현재 기기에서 종료</p>
            </div>
            <button class="action-button danger" type="button" @click="handleLogout">로그아웃</button>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <p class="setting-label">모든 기기</p>
              <p class="setting-description">전체 세션 종료</p>
            </div>
            <button class="action-button danger" type="button" :disabled="accountActionLoading" @click="handleLogoutAllDevices">로그아웃</button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title danger-title">계정 삭제</h2>
        <div class="section-content danger-content">
          <div class="setting-item">
            <div class="setting-info">
              <p class="setting-label">삭제 요청</p>
              <p class="setting-description">30일 후 삭제</p>
            </div>
            <button class="action-button danger solid" type="button" @click="showDeletePanel = !showDeletePanel">
              {{ showDeletePanel ? '닫기' : '삭제' }}
            </button>
          </div>
          <form v-if="showDeletePanel" class="inline-form" @submit.prevent="handleDeleteAccount">
            <label v-if="linkedAccounts?.has_password" class="input-wrapper" for="delete-password">
              <span>계정 비밀번호</span>
              <input id="delete-password" v-model="deletePassword" type="password" autocomplete="current-password">
            </label>
            <p v-else class="setting-description padded">비밀번호 설정 후 삭제할 수 있습니다.</p>
            <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
            <div class="inline-actions">
              <button class="action-button" type="button" @click="resetDeletePanel">취소</button>
              <button class="action-button danger solid" type="submit" :disabled="accountActionLoading || !linkedAccounts?.has_password">삭제 요청</button>
            </div>
          </form>
        </div>
      </section>

      <section v-if="showMergeModal && mergeInfo" class="settings-section">
        <h2 class="section-title">소셜 계정 병합</h2>
        <div class="section-content merge-content">
          <p class="merge-copy">{{ getProviderDisplayName(mergeInfo.provider) }} 계정이 다른 계정에 연결되어 있습니다.</p>
          <button class="select-btn" type="button" :disabled="mergeLoading" @click="handleMerge('current')">현재 계정 유지</button>
          <button class="select-btn secondary" type="button" :disabled="mergeLoading" @click="handleMerge('other')">연결된 계정 유지</button>
          <button class="action-button" type="button" :disabled="mergeLoading" @click="closeMergeModal">취소</button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'
import { useHead } from '#imports'
import type { AuthUser } from '~/composables/useAuthService'
import PageHeader from '~/components/PageHeader.vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'
import { useModal } from '~/composables/useModal'
import {
  buildNotificationSettingsPayload,
  buildOAuthLinkUrl,
  buildPasswordMergePayload,
  buildSocialMergePayload,
  mergeEmailUpdateIntoAuthUser,
} from '~/utils/accountSettingsRuntime'
import type { AccountKeepChoice, AccountProvider } from '~/utils/accountSettingsTypes'

useHead({ title: '계정 설정 - 매일일독' })

type Provider = AccountProvider
type KeepAccount = AccountKeepChoice

interface LinkedAccount {
  provider: Provider
  provider_display: string
  email: string | null
  profile_image: string | null
  linked_at: string
  can_unlink: boolean
}

interface AuthMethods {
  total: number
  password: boolean
  social_count: number
  providers: Provider[]
  can_remove_login_method: boolean
}

interface LinkedAccountsResponse {
  has_password: boolean
  email: string | null
  primary_email?: string | null
  auth_methods?: AuthMethods
  linked_accounts: LinkedAccount[]
}

interface MergeAccountSummary {
  id: number
  nickname: string
  email: string | null
  profile_image: string | null
  providers: Provider[]
  has_password: boolean
  created_at: string
}

interface MergeInfo {
  provider: Provider
  code: string
  id_token?: string
  merge_token?: string
  current_account: MergeAccountSummary
  other_account: MergeAccountSummary
}

interface NotificationSettings {
  daily_reading_reminder: boolean
  weekly_progress_summary: boolean
  service_notice: boolean
  reminder_time: string
}

interface NativeWindow extends Window {
  ReactNativeWebView?: {
    postMessage(message: string): void
  }
}

const PROVIDERS: Provider[] = ['kakao', 'google', 'apple']
const PROVIDER_LABELS: Record<Provider, string> = {
  kakao: '카카오',
  google: 'Google',
  apple: 'Apple',
}

const auth = useAuthService()
const api = useApi()
const modal = useModal()
const config = useRuntimeConfig()
const user = computed(() => auth.user.value)

const loading = ref(true)
const linkedAccounts = ref<LinkedAccountsResponse | null>(null)
const linkingProvider = ref<Provider | null>(null)

const showEmailPanel = ref(false)
const emailLoading = ref(false)
const emailError = ref('')
const emailForm = reactive({
  email: '',
  currentPassword: '',
})

const showPasswordPanel = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const passwordError = ref('')
const passwordLoading = ref(false)

const showDeletePanel = ref(false)
const deletePassword = ref('')
const deleteError = ref('')
const accountActionLoading = ref(false)

const resendingEmail = ref(false)
const emailCooldown = ref(0)
let emailCooldownTimer: ReturnType<typeof setInterval> | null = null

const showMergeModal = ref(false)
const mergeInfo = ref<MergeInfo | null>(null)
const mergeLoading = ref(false)

const passwordMergeLoading = ref(false)
const passwordMergeError = ref('')
const passwordMergeForm = reactive({
  targetIdentifier: '',
  targetPassword: '',
  keepAccount: 'current' as KeepAccount,
})

const notificationLoading = ref(false)
const notificationSettings = reactive<NotificationSettings>({
  daily_reading_reminder: true,
  weekly_progress_summary: false,
  service_notice: true,
  reminder_time: '07:00',
})

const emailButtonText = computed(() => {
  if (resendingEmail.value) return '전송 중...'
  if (emailCooldown.value > 0) return `${emailCooldown.value}초`
  return '인증 메일 발송'
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const getString = (record: Record<string, unknown>, key: string) => typeof record[key] === 'string' ? record[key] as string : null
const getBoolean = (record: Record<string, unknown>, key: string) => record[key] === true
const getNumber = (record: Record<string, unknown>, key: string) => typeof record[key] === 'number' ? record[key] as number : 0
const isProvider = (provider: string): provider is Provider => provider === 'kakao' || provider === 'google' || provider === 'apple'
const parseProvider = (value: unknown): Provider | null => typeof value === 'string' && isProvider(value) ? value : null

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (!isRecord(error)) return fallback
  const data = error.data
  if (isRecord(data)) return getString(data, 'error') || getString(data, 'detail') || getString(data, 'message') || fallback
  return getString(error, 'message') || fallback
}

const getProviderDisplayName = (provider: string) => isProvider(provider) ? PROVIDER_LABELS[provider] : provider

const normalizeLinkedAccounts = (payload: unknown): LinkedAccountsResponse => {
  if (!isRecord(payload)) return { has_password: false, email: null, primary_email: null, linked_accounts: [] }
  const accountItems = Array.isArray(payload.linked_accounts) ? payload.linked_accounts : []
  const authMethodsPayload = isRecord(payload.auth_methods) ? payload.auth_methods : null
  return {
    has_password: getBoolean(payload, 'has_password'),
    email: getString(payload, 'email') || getString(payload, 'primary_email'),
    primary_email: getString(payload, 'primary_email') || getString(payload, 'email'),
    auth_methods: authMethodsPayload
      ? {
          total: getNumber(authMethodsPayload, 'total'),
          password: getBoolean(authMethodsPayload, 'password'),
          social_count: getNumber(authMethodsPayload, 'social_count'),
          providers: Array.isArray(authMethodsPayload.providers) ? authMethodsPayload.providers.flatMap(provider => parseProvider(provider) ? [parseProvider(provider) as Provider] : []) : [],
          can_remove_login_method: getBoolean(authMethodsPayload, 'can_remove_login_method'),
        }
      : undefined,
    linked_accounts: accountItems.flatMap((item): LinkedAccount[] => {
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
    }),
  }
}

const normalizeMergeAccountSummary = (payload: unknown): MergeAccountSummary | null => {
  if (!isRecord(payload)) return null
  const providerItems = Array.isArray(payload.providers) ? payload.providers : []
  return {
    id: getNumber(payload, 'id'),
    nickname: getString(payload, 'nickname') || '',
    email: getString(payload, 'email'),
    profile_image: getString(payload, 'profile_image'),
    providers: providerItems.flatMap(provider => parseProvider(provider) ? [parseProvider(provider) as Provider] : []),
    has_password: getBoolean(payload, 'has_password'),
    created_at: getString(payload, 'created_at') || '',
  }
}

const normalizeMergeInfo = (payload: unknown): MergeInfo | null => {
  if (!isRecord(payload)) return null
  const provider = parseProvider(payload.provider)
  const code = getString(payload, 'code')
  const currentAccount = normalizeMergeAccountSummary(payload.current_account)
  const otherAccount = normalizeMergeAccountSummary(payload.other_account)
  if (!provider || !code || !currentAccount || !otherAccount) return null
  return {
    provider,
    code,
    id_token: getString(payload, 'id_token') || undefined,
    merge_token: getString(payload, 'merge_token') || undefined,
    current_account: currentAccount,
    other_account: otherAccount,
  }
}

const normalizeNotificationSettings = (payload: unknown): NotificationSettings => {
  if (!isRecord(payload)) return { ...notificationSettings }
  return {
    daily_reading_reminder: getBoolean(payload, 'daily_reading_reminder'),
    weekly_progress_summary: getBoolean(payload, 'weekly_progress_summary'),
    service_notice: getBoolean(payload, 'service_notice'),
    reminder_time: getString(payload, 'reminder_time') || '07:00',
  }
}

const normalizeAuthUser = (payload: unknown): AuthUser | null => {
  if (!isRecord(payload)) return null
  const id = getNumber(payload, 'id')
  const username = getString(payload, 'username') || ''
  const nickname = getString(payload, 'nickname') || ''
  if (!id || !nickname) return null
  return {
    id,
    username,
    nickname,
    email: getString(payload, 'email') || undefined,
    profile_image: getString(payload, 'profile_image') || undefined,
    is_staff: getBoolean(payload, 'is_staff'),
    email_verified: getBoolean(payload, 'email_verified'),
    has_usable_password_flag: getBoolean(payload, 'has_usable_password_flag'),
  }
}

const getLinkedAccount = (provider: Provider) => linkedAccounts.value?.linked_accounts.find(account => account.provider === provider)
const isProviderLinked = (provider: Provider) => linkedAccounts.value?.linked_accounts.some(account => account.provider === provider) ?? false
const canUnlink = (provider: Provider) => getLinkedAccount(provider)?.can_unlink ?? false

const fetchLinkedAccounts = async () => {
  try {
    const response = await api.get('/api/v1/auth/linked-accounts/')
    linkedAccounts.value = normalizeLinkedAccounts(response.data)
    emailForm.email = linkedAccounts.value.email || user.value?.email || ''
  } catch (error: unknown) {
    await modal.alert({ title: '계정 정보를 불러오지 못했습니다', description: getErrorMessage(error, '잠시 후 다시 시도해주세요.'), icon: 'error' })
  } finally {
    loading.value = false
  }
}

const fetchNotificationSettings = async () => {
  const response = await api.get('/api/v1/auth/notification-settings/')
  Object.assign(notificationSettings, normalizeNotificationSettings(response.data))
}

const getOAuthLinkState = async () => {
  const response = await api.post('/api/v1/auth/oauth/link-state/')
  const state = isRecord(response) ? getString(response, 'state') : null
  if (!state) throw new Error('Invalid OAuth state')
  const encodedState = encodeURIComponent(state)
  return decodeURIComponent(encodedState)
}

const getProviderOAuthConfig = (provider: Provider) => {
  if (provider === 'kakao') return { clientId: config.public.KAKAO_CLIENT_ID, redirectUri: config.public.KAKAO_REDIRECT_URI, baseUrl: 'https://kauth.kakao.com/oauth/authorize', scope: null }
  if (provider === 'google') return { clientId: config.public.GOOGLE_CLIENT_ID, redirectUri: config.public.GOOGLE_REDIRECT_URI, baseUrl: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'email profile' }
  return { clientId: config.public.APPLE_CLIENT_ID, redirectUri: config.public.APPLE_REDIRECT_URI || `${window.location.origin}/auth/apple/callback`, baseUrl: 'https://appleid.apple.com/auth/authorize', scope: 'name email' }
}

const handleLinkProvider = async (provider: Provider) => {
  const { clientId, redirectUri, baseUrl, scope } = getProviderOAuthConfig(provider)
  if (!clientId || !redirectUri) {
    await modal.alert({ title: '연결 설정 오류', description: `${getProviderDisplayName(provider)} 연결 설정을 확인해주세요.`, icon: 'error' })
    return
  }

  linkingProvider.value = provider
  try {
    const state = await getOAuthLinkState()
    const authUrl = buildOAuthLinkUrl(provider, {
      clientId: String(clientId),
      redirectUri: String(redirectUri),
      baseUrl,
      scope,
    }, state)
    window.location.assign(authUrl)
  } catch (error: unknown) {
    linkingProvider.value = null
    await modal.alert({ title: '연결 실패', description: getErrorMessage(error, '계정 연결을 시작하지 못했습니다.'), icon: 'error' })
  }
}

const handleLinkKakao = () => handleLinkProvider('kakao')
const handleLinkGoogle = () => handleLinkProvider('google')
const handleLinkApple = () => handleLinkProvider('apple')

const handleUpdateEmail = async () => {
  emailError.value = ''
  emailLoading.value = true
  try {
    const response = await api.patch('/api/v1/auth/account-email/', {
      email: emailForm.email,
      current_password: emailForm.currentPassword || undefined,
    })
    if (auth.user.value && isRecord(response)) {
      auth.setUser(mergeEmailUpdateIntoAuthUser(auth.user.value, {
        email: getString(response, 'email'),
        email_verified: response.email_verified === true ? true : response.email_verified === false ? false : undefined,
      }, emailForm.email))
    }
    resetEmailPanel()
    await fetchLinkedAccounts()
    await modal.alert({ title: '이메일 저장 완료', description: '이메일이 변경되었습니다.', icon: 'success' })
  } catch (error: unknown) {
    emailError.value = getErrorMessage(error, '이메일을 변경하지 못했습니다.')
  } finally {
    emailLoading.value = false
  }
}

const resetEmailPanel = () => {
  showEmailPanel.value = false
  emailForm.email = linkedAccounts.value?.email || user.value?.email || ''
  emailForm.currentPassword = ''
  emailError.value = ''
}

const handleSetPassword = async () => {
  passwordError.value = ''
  if (newPassword.value.length < 8) {
    passwordError.value = '비밀번호는 8자 이상이어야 합니다'
    return
  }
  if (newPassword.value !== newPasswordConfirm.value) {
    passwordError.value = '비밀번호가 일치하지 않습니다'
    return
  }
  passwordLoading.value = true
  try {
    await api.post('/api/v1/auth/set-password/', {
      current_password: currentPassword.value || undefined,
      new_password: newPassword.value,
      new_password_confirm: newPasswordConfirm.value,
    })
    resetPasswordPanel()
    await fetchLinkedAccounts()
    await modal.alert({ title: '비밀번호 저장 완료', description: '비밀번호가 저장되었습니다.', icon: 'success' })
  } catch (error: unknown) {
    passwordError.value = getErrorMessage(error, '비밀번호를 저장하지 못했습니다.')
  } finally {
    passwordLoading.value = false
  }
}

const resetPasswordPanel = () => {
  showPasswordPanel.value = false
  currentPassword.value = ''
  newPassword.value = ''
  newPasswordConfirm.value = ''
  passwordError.value = ''
}

const handlePasswordMerge = async () => {
  passwordMergeError.value = ''
  const confirmed = await modal.confirm({ title: '기존 계정 병합', description: '선택하지 않은 계정은 30일 후 삭제됩니다.', confirmText: '병합', confirmVariant: 'danger', icon: 'warning' })
  if (!confirmed) return

  passwordMergeLoading.value = true
  try {
    const response = await api.post('/api/v1/auth/merge-accounts/', buildPasswordMergePayload(passwordMergeForm))
    if (passwordMergeForm.keepAccount === 'other' && isRecord(response)) {
      const access = getString(response, 'access')
      const refresh = getString(response, 'refresh')
      const responseUser = normalizeAuthUser(response.user)
      if (access && refresh && responseUser) {
        auth.setTokens(access, refresh)
        auth.setUser(responseUser)
      }
    }
    passwordMergeForm.targetIdentifier = ''
    passwordMergeForm.targetPassword = ''
    passwordMergeForm.keepAccount = 'current'
    await fetchLinkedAccounts()
    await modal.alert({ title: '계정 병합 완료', description: '계정이 병합되었습니다.', icon: 'success' })
  } catch (error: unknown) {
    passwordMergeError.value = getErrorMessage(error, '계정을 병합하지 못했습니다.')
  } finally {
    passwordMergeLoading.value = false
  }
}

const saveNotificationSettings = async () => {
  notificationLoading.value = true
  try {
    const response = await api.patch('/api/v1/auth/notification-settings/', buildNotificationSettingsPayload(notificationSettings))
    Object.assign(notificationSettings, normalizeNotificationSettings(response))
    await modal.alert({ title: '알림 저장 완료', description: '알림 설정이 저장되었습니다.', icon: 'success' })
  } catch (error: unknown) {
    await modal.alert({ title: '알림 저장 실패', description: getErrorMessage(error, '알림 설정을 저장하지 못했습니다.'), icon: 'error' })
  } finally {
    notificationLoading.value = false
  }
}

const handleResendVerification = async () => {
  if (resendingEmail.value || emailCooldown.value > 0) return
  resendingEmail.value = true
  try {
    await api.post('/api/v1/auth/resend-verification/')
    await modal.alert({ title: '인증 메일 발송', description: '메일함을 확인해주세요.', icon: 'success' })
    emailCooldown.value = 60
    emailCooldownTimer = setInterval(() => {
      emailCooldown.value -= 1
      if (emailCooldown.value <= 0 && emailCooldownTimer) {
        clearInterval(emailCooldownTimer)
        emailCooldownTimer = null
      }
    }, 1000)
  } catch (error: unknown) {
    await modal.alert({ title: '발송 실패', description: getErrorMessage(error, '메일 발송에 실패했습니다.'), icon: 'error' })
  } finally {
    resendingEmail.value = false
  }
}

const handleUnlink = async (provider: Provider) => {
  const confirmed = await modal.confirm({ title: '계정 연결 해제', description: `${getProviderDisplayName(provider)} 연결을 해제하시겠습니까?`, confirmText: '해제', confirmVariant: 'danger' })
  if (!confirmed) return
  try {
    await api.post('/api/v1/auth/unlink-social/', { provider })
    await fetchLinkedAccounts()
  } catch (error: unknown) {
    await modal.alert({ title: '연결 해제 실패', description: getErrorMessage(error, '연결 해제에 실패했습니다.'), icon: 'error' })
  }
}

const buildMergePayload = (keepAccount: KeepAccount) => {
  if (!mergeInfo.value) return null
  return buildSocialMergePayload(mergeInfo.value, keepAccount)
}

const handleMerge = async (keepAccount: KeepAccount) => {
  const payload = buildMergePayload(keepAccount)
  if (!payload) return
  mergeLoading.value = true
  try {
    const response = await api.post('/api/v1/auth/merge-accounts/', payload)
    if (keepAccount === 'other' && isRecord(response)) {
      const access = getString(response, 'access')
      const refresh = getString(response, 'refresh')
      const responseUser = normalizeAuthUser(response.user)
      if (access && refresh && responseUser) {
        auth.setTokens(access, refresh)
        auth.setUser(responseUser)
      }
    }
    closeMergeModal()
    await fetchLinkedAccounts()
    await modal.alert({ title: '계정 병합 완료', description: '계정이 병합되었습니다.', icon: 'success' })
  } catch (error: unknown) {
    await modal.alert({ title: '병합 실패', description: getErrorMessage(error, '계정 병합에 실패했습니다.'), icon: 'error' })
  } finally {
    mergeLoading.value = false
  }
}

const closeMergeModal = () => {
  showMergeModal.value = false
  mergeInfo.value = null
}

const handleLogout = async () => {
  const confirmed = await modal.confirm({ title: '로그아웃', description: '로그아웃하시겠습니까?', confirmText: '로그아웃', confirmVariant: 'danger' })
  if (!confirmed) return
  const nativeWindow: NativeWindow = window
  if (nativeWindow.ReactNativeWebView) {
    nativeWindow.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestLogout' }))
    return
  }
  await auth.logout()
  navigateTo('/')
}

const handleLogoutAllDevices = async () => {
  const confirmed = await modal.confirm({ title: '모든 기기에서 로그아웃', description: '전체 세션을 종료합니다.', confirmText: '로그아웃', confirmVariant: 'danger', icon: 'warning' })
  if (!confirmed) return
  accountActionLoading.value = true
  try {
    await api.post('/api/v1/auth/logout-all/')
    await auth.logout()
    navigateTo('/')
  } catch (error: unknown) {
    await modal.alert({ title: '로그아웃 실패', description: getErrorMessage(error, '로그아웃에 실패했습니다.'), icon: 'error' })
  } finally {
    accountActionLoading.value = false
  }
}

const handleDeleteAccount = async () => {
  deleteError.value = ''
  if (!linkedAccounts.value?.has_password) {
    deleteError.value = '계정 삭제 전 비밀번호를 먼저 설정해주세요'
    return
  }
  if (!deletePassword.value) {
    deleteError.value = '계정 비밀번호를 입력해주세요'
    return
  }
  const confirmed = await modal.confirm({ title: '계정 삭제', description: '삭제 요청 후 30일 뒤 삭제됩니다.', confirmText: '삭제', confirmVariant: 'danger', icon: 'warning' })
  if (!confirmed) return
  accountActionLoading.value = true
  try {
    await api.post('/api/v1/auth/delete-account/', { password: deletePassword.value, confirm_delete: true })
    await auth.logout()
    navigateTo('/')
  } catch (error: unknown) {
    deleteError.value = getErrorMessage(error, '계정 삭제에 실패했습니다.')
  } finally {
    accountActionLoading.value = false
  }
}

const resetDeletePanel = () => {
  showDeletePanel.value = false
  deletePassword.value = ''
  deleteError.value = ''
}

onMounted(async () => {
  if (!auth.isAuthenticated.value) {
    navigateTo('/login')
    return
  }

  const route = useRoute()
  if (route.query.linked === 'success') {
    const provider = typeof route.query.provider === 'string' ? route.query.provider : ''
    await modal.alert({ title: '연결 완료', description: `${getProviderDisplayName(provider)} 계정이 연결되었습니다.`, icon: 'success' })
    navigateTo('/account/settings', { replace: true })
  } else if (route.query.linked === 'error') {
    const message = typeof route.query.message === 'string' ? route.query.message : '계정 연결에 실패했습니다.'
    await modal.alert({ title: '연결 실패', description: message, icon: 'error' })
    navigateTo('/account/settings', { replace: true })
  }

  if (route.query.action === 'merge') {
    const storedMergeInfo = sessionStorage.getItem('merge_info')
    if (storedMergeInfo) {
      mergeInfo.value = normalizeMergeInfo(JSON.parse(storedMergeInfo))
      showMergeModal.value = mergeInfo.value !== null
      sessionStorage.removeItem('merge_info')
    }
    navigateTo('/account/settings', { replace: true })
  }

  await Promise.all([fetchLinkedAccounts(), fetchNotificationSettings()])
})

onUnmounted(() => {
  if (emailCooldownTimer) clearInterval(emailCooldownTimer)
})
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.settings-shell {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem 1rem 2.5rem;
}

.settings-section {
  margin-bottom: 2rem;
}

.section-title {
  margin: 0 0 0.75rem;
  padding-left: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
}

.profile-summary,
.section-content {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  overflow: hidden;
}

.profile-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  flex: 0 0 auto;
}

.profile-avatar img,
.avatar-placeholder {
  width: 100%;
  height: 100%;
}

.avatar-placeholder {
  display: grid;
  place-items: center;
  background: var(--primary-light);
  color: var(--primary-color);
  font-size: 1.4rem;
  font-weight: 700;
}

.profile-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.profile-copy strong {
  color: var(--color-text-primary);
}

.profile-copy span,
.setting-description,
.section-note {
  color: var(--color-text-tertiary);
  font-size: 0.8125rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-light);
}

.setting-item:last-child {
  border-bottom: 0;
}

.setting-info {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.setting-label {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  font-weight: 600;
}

.setting-description {
  margin: 0;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-icon {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.provider-icon.kakao { background: #fee500; color: #191600; }
.provider-icon.google { background: #e8f0fe; color: #1a73e8; }
.provider-icon.apple { background: #111827; color: #fff; }

.action-button,
.select-btn {
  min-height: 38px;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--color-border-default);
  border-radius: 6px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.action-button.primary,
.select-btn {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.select-btn.secondary {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

.action-button.danger {
  color: var(--color-error);
  border-color: var(--color-error-bg);
}

.action-button.danger.solid {
  color: white;
  background: var(--color-error);
  border-color: var(--color-error);
}

.action-button:disabled,
.select-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.inline-form {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid var(--color-border-light);
}

.input-wrapper {
  display: grid;
  gap: 0.375rem;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.input-wrapper input,
.input-wrapper select {
  min-height: 42px;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border-default);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.9375rem;
}

.input-wrapper.compact {
  width: 100%;
}

.input-wrapper input:focus,
.input-wrapper select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.error-text {
  margin: 0;
  color: var(--color-error);
  font-size: 0.8125rem;
}

.section-note {
  margin: 0.5rem 0 0;
  padding-left: 0.25rem;
}

.switch-row {
  cursor: pointer;
}

.switch-row input[type="checkbox"] {
  width: 44px;
  height: 24px;
  accent-color: var(--primary-color);
}

.align-end {
  justify-content: flex-end;
}

.merge-content {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.merge-copy,
.padded {
  margin: 0;
}

.danger-title {
  color: var(--color-error);
}

@media (max-width: 640px) {
  .settings-shell {
    padding: 0.75rem 0.75rem 2rem;
  }

  .setting-item {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-item > .action-button,
  .setting-item > .select-btn {
    width: 100%;
  }

  .switch-row {
    flex-direction: row;
    align-items: center;
  }
}
</style>
