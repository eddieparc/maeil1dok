<!-- noqa: SIZE_OK account settings is the existing full account-management surface; this hardening keeps one route-level SFC stable -->
<template>
  <div class="settings-container">
    <div class="settings-box">
      <!-- Header -->
      <div class="settings-header">
        <button @click="handleBack" class="back-btn">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="page-title">계정 설정</h1>
        <div class="spacer"></div>
      </div>

        <!-- 프로필 섹션 -->
        <section class="settings-section">
          <h2 class="section-title">프로필</h2>
            <div class="profile-card">
              <div class="profile-avatar">
                <NuxtImg
                  v-if="user?.profile_image"
                  :src="user.profile_image"
                  :alt="user.nickname"
                  loading="lazy"
                />
                <div v-else class="avatar-placeholder">
                  {{ user?.nickname?.charAt(0) || '?' }}
                </div>
              </div>

            <div class="profile-info">
              <p class="profile-nickname">{{ user?.nickname }}</p>
              <p class="profile-email">{{ linkedAccounts?.email || '이메일 없음' }}</p>
            </div>
          </div>
        </section>

        <!-- 이메일 인증 섹션 (이메일 가입 사용자 중 미인증인 경우만) -->
        <section v-if="user?.email && user?.has_usable_password_flag && !user?.email_verified" class="settings-section">
          <h2 class="section-title">이메일 인증</h2>
          <div class="section-content">
            <div class="setting-item verification-item">
              <div class="setting-info">
                <div class="verification-status">
                  <svg class="warning-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <span class="setting-label">이메일 인증 필요</span>
                </div>
                <p class="setting-description">
                  {{ user?.email }}로 인증 메일을 발송합니다
                </p>
              </div>
              <button 
                @click="handleResendVerification" 
                class="action-button primary"
                :disabled="resendingEmail || emailCooldown > 0"
              >
                {{ emailButtonText }}
              </button>
            </div>
          </div>
        </section>

        <!-- 이메일 인증 완료 상태 (이메일 가입 사용자 중 인증 완료) -->
        <section v-else-if="user?.email && user?.has_usable_password_flag && user?.email_verified" class="settings-section">
          <h2 class="section-title">이메일 인증</h2>
          <div class="section-content">
            <div class="setting-item">
              <div class="setting-info">
                <div class="verification-status verified">
                  <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  <span class="setting-label">인증 완료</span>
                </div>
                <p class="setting-description">{{ user?.email }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 비밀번호 섹션 -->
        <section class="settings-section">
          <h2 class="section-title">비밀번호</h2>
          <div class="section-content">
            <div class="setting-item">
              <div class="setting-info">
                <p class="setting-label">비밀번호 설정</p>
                <p class="setting-description">
                  {{ linkedAccounts?.has_password ? '비밀번호가 설정되어 있습니다' : '이메일 로그인을 위해 비밀번호를 설정하세요' }}
                </p>
              </div>
              <button
                @click="showPasswordPanel = !showPasswordPanel"
                class="action-button"
              >
                {{ showPasswordPanel ? '닫기' : (linkedAccounts?.has_password ? '변경' : '설정') }}
              </button>
            </div>
            <form v-if="showPasswordPanel" @submit.prevent="handleSetPassword" class="inline-sensitive-form">
              <div v-if="linkedAccounts?.has_password" class="input-wrapper">
                <label for="current-password">현재 비밀번호</label>
                <input
                  id="current-password"
                  v-model="currentPassword"
                  type="password"
                  placeholder="현재 비밀번호"
                  autocomplete="current-password"
                >
              </div>
              <div class="input-wrapper">
                <label for="new-password">새 비밀번호</label>
                <input
                  id="new-password"
                  v-model="newPassword"
                  type="password"
                  placeholder="8자 이상 (문자+숫자)"
                  autocomplete="new-password"
                >
              </div>
              <div class="input-wrapper">
                <label for="new-password-confirm">비밀번호 확인</label>
                <input
                  id="new-password-confirm"
                  v-model="newPasswordConfirm"
                  type="password"
                  placeholder="비밀번호 재입력"
                  autocomplete="new-password"
                >
              </div>
              <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
              <div class="inline-actions">
                <button type="button" class="action-button" @click="resetPasswordPanel">취소</button>
                <button type="submit" class="action-button primary" :disabled="passwordLoading">
                  {{ passwordLoading ? '처리 중...' : '저장' }}
                </button>
              </div>
            </form>
          </div>
        </section>

        <!-- 연결된 계정 섹션 -->
        <section class="settings-section">
          <h2 class="section-title">연결된 계정</h2>
          <div class="section-content">
            <SkeletonList v-if="loading" :count="3" variant="user" />
            <template v-else>
              <!-- 카카오 -->
              <div class="setting-item">
              <div class="setting-info">
                <div class="provider-badge kakao">
                  <NuxtImg
                    src="/images/kakao.png"
                    width="16"
                    height="16"
                    alt="카카오"
                    loading="lazy"
                    format="webp"
                  />
                  <span>카카오</span>
                </div>
                <p class="setting-description">
                  {{ getLinkedAccount('kakao')?.email || (isKakaoLinked ? '연결됨' : '연결되지 않음') }}
                </p>
              </div>
              <button 
                v-if="isKakaoLinked"
                @click="handleUnlink('kakao')" 
                class="action-button danger"
                :disabled="!canUnlink('kakao')"
              >
                연결 해제
              </button>
              <button 
                v-else
                @click="handleLinkKakao" 
                class="action-button primary"
              >
                연결
              </button>
            </div>

            <!-- 구글 -->
            <div class="setting-item">
              <div class="setting-info">
                <div class="provider-badge google">
                  <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>구글</span>
                </div>
                <p class="setting-description">
                  {{ getLinkedAccount('google')?.email || (isGoogleLinked ? '연결됨' : '연결되지 않음') }}
                </p>
              </div>
              <button 
                v-if="isGoogleLinked"
                @click="handleUnlink('google')" 
                class="action-button danger"
                :disabled="!canUnlink('google')"
              >
                연결 해제
              </button>
              <button 
                v-else
                @click="handleLinkGoogle" 
                class="action-button primary"
              >
                연결
              </button>
            </div>

            <!-- 애플 -->
            <div class="setting-item">
              <div class="setting-info">
                <div class="provider-badge apple">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span>애플</span>
                </div>
                <p class="setting-description">
                  {{ getLinkedAccount('apple')?.email || (isAppleLinked ? '연결됨' : '연결되지 않음') }}
                </p>
              </div>
              <button 
                v-if="isAppleLinked"
                @click="handleUnlink('apple')" 
                class="action-button danger"
                :disabled="!canUnlink('apple')"
              >
                연결 해제
              </button>
              <button 
                v-else
                @click="handleLinkApple" 
                class="action-button primary"
              >
                연결
              </button>
            </div>
            </template>
          </div>
          <p class="section-note">
            * 최소 하나의 로그인 방법(비밀번호 또는 소셜 계정)이 있어야 합니다
          </p>
        </section>

        <!-- 로그아웃 -->
        <section class="settings-section">
          <button @click="handleLogout" class="logout-button">
            로그아웃
          </button>
        </section>

        <section class="settings-section">
          <button @click="handleLogoutAllDevices" class="logout-button" :disabled="accountActionLoading">
            모든 기기에서 로그아웃
          </button>
          <p class="section-note">
            현재 브라우저를 포함한 모든 기기의 로그인 세션을 종료합니다
          </p>
        </section>

        <!-- 계정 삭제 -->
        <section class="settings-section">
          <button @click="showDeletePanel = !showDeletePanel" class="delete-account-button">
            {{ showDeletePanel ? '계정 삭제 닫기' : '계정 삭제' }}
          </button>
          <p class="section-note danger-note">
            * 계정 삭제 요청 후 30일간 유예 기간이 있으며, 이후 완전히 삭제됩니다
          </p>
          <form v-if="showDeletePanel" @submit.prevent="handleDeleteAccount" class="inline-sensitive-form danger-form">
            <div v-if="linkedAccounts?.has_password" class="input-wrapper">
              <label for="delete-password">계정 비밀번호</label>
              <input
                id="delete-password"
                v-model="deletePassword"
                type="password"
                placeholder="계정 비밀번호"
                autocomplete="current-password"
              >
            </div>
            <p v-else class="setting-description">
              계정 삭제는 보안을 위해 비밀번호 설정 후 진행할 수 있습니다.
            </p>
            <p class="setting-description">
              삭제 요청 후 30일 안에 다시 로그인하면 삭제가 취소됩니다. 30일 이후에는 복구할 수 없습니다.
            </p>
            <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
            <div class="inline-actions">
              <button type="button" class="action-button" @click="resetDeletePanel">취소</button>
              <button type="submit" class="action-button danger solid" :disabled="accountActionLoading || !linkedAccounts?.has_password">
                {{ accountActionLoading ? '처리 중...' : '삭제 요청' }}
              </button>
            </div>
          </form>
        </section>

        <!-- 계정 병합 -->
        <section v-if="showMergeModal && mergeInfo" class="settings-section">
          <div class="merge-modal-content">
          <h3 class="modal-title">계정 병합</h3>
          <p class="merge-description">
            이 {{ getProviderDisplayName(mergeInfo.provider) }} 계정은 다른 매일일독 계정에 연결되어 있습니다.<br>
            <strong>어느 계정을 유지하시겠습니까?</strong>
          </p>
          
          <div class="merge-accounts">
            <!-- 현재 계정 -->
            <div 
              class="account-card"
              :class="{ 'selected': false }"
              @click="handleMerge('current')"
            >
              <div class="account-badge">현재 로그인</div>
              <div class="account-avatar">
                <NuxtImg
                  v-if="mergeInfo.current_account.profile_image"
                  :src="mergeInfo.current_account.profile_image"
                  alt=""
                  loading="lazy"
                />
                <div v-else class="avatar-placeholder">
                  {{ mergeInfo.current_account.nickname?.charAt(0) || '?' }}
                </div>
              </div>
              <div class="account-info">
                <p class="account-nickname">{{ mergeInfo.current_account.nickname }}</p>
                <p class="account-email">{{ mergeInfo.current_account.email || '이메일 없음' }}</p>
                <p class="account-providers">
                  <span v-for="p in mergeInfo.current_account.providers" :key="p" class="provider-tag">
                    {{ getProviderDisplayName(p) }}
                  </span>
                  <span v-if="mergeInfo.current_account.has_password" class="provider-tag password">비밀번호</span>
                </p>
                <p class="account-date">가입: {{ formatDate(mergeInfo.current_account.created_at) }}</p>
              </div>
              <button 
                class="select-btn" 
                :disabled="mergeLoading"
                @click.stop="handleMerge('current')"
              >
                이 계정 유지
              </button>
            </div>

            <!-- 다른 계정 -->
            <div 
              class="account-card"
              @click="handleMerge('other')"
            >
              <div class="account-badge other">{{ getProviderDisplayName(mergeInfo.provider) }} 연결 계정</div>
              <div class="account-avatar">
                <NuxtImg
                  v-if="mergeInfo.other_account.profile_image"
                  :src="mergeInfo.other_account.profile_image"
                  alt=""
                  loading="lazy"
                />
                <div v-else class="avatar-placeholder">
                  {{ mergeInfo.other_account.nickname?.charAt(0) || '?' }}
                </div>
              </div>
              <div class="account-info">
                <p class="account-nickname">{{ mergeInfo.other_account.nickname }}</p>
                <p class="account-email">{{ mergeInfo.other_account.email || '이메일 없음' }}</p>
                <p class="account-providers">
                  <span v-for="p in mergeInfo.other_account.providers" :key="p" class="provider-tag">
                    {{ getProviderDisplayName(p) }}
                  </span>
                  <span v-if="mergeInfo.other_account.has_password" class="provider-tag password">비밀번호</span>
                </p>
                <p class="account-date">가입: {{ formatDate(mergeInfo.other_account.created_at) }}</p>
              </div>
              <button 
                class="select-btn" 
                :disabled="mergeLoading"
                @click.stop="handleMerge('other')"
              >
                이 계정 유지
              </button>
            </div>
          </div>

          <p class="merge-warning">
            선택하지 않은 계정은 30일 후 완전히 삭제됩니다.<br>
            해당 계정의 소셜 연결만 유지 계정으로 이전됩니다.
          </p>

          <button class="btn-cancel-full" @click="closeMergeModal" :disabled="mergeLoading">
            취소
          </button>
        </div>
        </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthService } from '~/composables/useAuthService'
import { useHead } from '#imports'
import { useModal } from '~/composables/useModal'
import { useNavigation } from '~/composables/useNavigation'
import { useApi } from '~/composables/useApi'
import { useRuntimeConfig } from 'nuxt/app'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'

useHead({
  title: '계정 설정 - 매일일독',
})

const auth = useAuthService()
const modal = useModal()
const api = useApi()
const config = useRuntimeConfig()
const { goBack } = useNavigation()

type Provider = 'kakao' | 'google' | 'apple'
type KeepAccount = 'current' | 'other'

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
  current_account: MergeAccountSummary
  other_account: MergeAccountSummary
}

interface NativeWindow extends Window {
  ReactNativeWebView?: {
    postMessage(message: string): void
  }
}

const PROVIDER_LABELS: Record<Provider, string> = {
  kakao: '카카오',
  google: '구글',
  apple: '애플',
}

const loading = ref(true)
const linkedAccounts = ref<LinkedAccountsResponse | null>(null)
const user = computed(() => auth.user.value)

const showPasswordPanel = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const passwordError = ref('')
const passwordLoading = ref(false)
const accountActionLoading = ref(false)
const showDeletePanel = ref(false)
const deletePassword = ref('')
const deleteError = ref('')

const resendingEmail = ref(false)
const emailCooldown = ref(0)
let emailCooldownTimer: ReturnType<typeof setInterval> | null = null

const showMergeModal = ref(false)
const mergeInfo = ref<MergeInfo | null>(null)
const mergeLoading = ref(false)

const emailButtonText = computed(() => {
  if (resendingEmail.value) return '전송 중...'
  if (emailCooldown.value > 0) return `${emailCooldown.value}초`
  return '인증 메일 발송'
})

const isKakaoLinked = computed(() => isProviderLinked('kakao'))
const isGoogleLinked = computed(() => isProviderLinked('google'))
const isAppleLinked = computed(() => isProviderLinked('apple'))

const isProviderLinked = (provider: Provider) =>
  linkedAccounts.value?.linked_accounts.some(account => account.provider === provider) ?? false

const getLinkedAccount = (provider: Provider) =>
  linkedAccounts.value?.linked_accounts.find(account => account.provider === provider)

const canUnlink = (provider: Provider) => {
  const account = getLinkedAccount(provider)
  return account?.can_unlink ?? false
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const getString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

const getBoolean = (record: Record<string, unknown>, key: string) => {
  return record[key] === true
}

const getNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'number' ? value : 0
}

const parseProvider = (value: unknown): Provider | null => {
  return typeof value === 'string' && isProvider(value) ? value : null
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (!isRecord(error)) return fallback
  const data = error.data
  if (isRecord(data)) {
    return getString(data, 'error') || getString(data, 'detail') || getString(data, 'message') || fallback
  }
  return getString(error, 'message') || fallback
}

const normalizeLinkedAccounts = (payload: unknown): LinkedAccountsResponse => {
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

  return {
    has_password: getBoolean(payload, 'has_password'),
    email: getString(payload, 'email') || getString(payload, 'primary_email'),
    primary_email: getString(payload, 'primary_email') || getString(payload, 'email'),
    auth_methods: authMethodsPayload
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
      : undefined,
    linked_accounts,
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
    providers: providerItems.flatMap((provider): Provider[] => {
      const parsedProvider = parseProvider(provider)
      return parsedProvider ? [parsedProvider] : []
    }),
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
    current_account: currentAccount,
    other_account: otherAccount,
  }
}

const fetchLinkedAccounts = async () => {
  try {
    const response = await api.get('/api/v1/auth/linked-accounts/')
    linkedAccounts.value = normalizeLinkedAccounts(response.data)
  } catch (error) {
    await modal.alert({
      title: '계정 정보를 불러오지 못했습니다',
      description: getErrorMessage(error, '잠시 후 다시 시도해주세요.'),
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}

const getOAuthLinkState = async () => {
  const response = await api.post('/api/v1/auth/oauth/link-state/')
  const state = response.data?.state
  if (typeof state !== 'string' || !state) {
    throw new Error('Invalid OAuth state')
  }
  return encodeURIComponent(state)
}

const handleLinkKakao = async () => {
  const redirectUri = encodeURIComponent(config.public.KAKAO_REDIRECT_URI)
  const state = await getOAuthLinkState()
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${config.public.KAKAO_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&state=${state}`
  window.location.href = kakaoAuthUrl
}

const handleLinkGoogle = async () => {
  const redirectUri = encodeURIComponent(config.public.GOOGLE_REDIRECT_URI)
  const state = await getOAuthLinkState()
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.public.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent&state=${state}`
  window.location.href = googleAuthUrl
}

const handleLinkApple = async () => {
  const clientId = config.public.APPLE_CLIENT_ID
  const redirectUri = encodeURIComponent(config.public.APPLE_REDIRECT_URI || `${window.location.origin}/auth/apple/callback`)
  const state = await getOAuthLinkState()
  const appleAuthUrl = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code%20id_token&scope=name%20email&response_mode=form_post&state=${state}`
  window.location.href = appleAuthUrl
}

const handleUnlink = async (provider: Provider) => {
  const confirmed = await modal.confirm({
    title: '계정 연결 해제',
    description: `${getProviderDisplayName(provider)} 계정 연결을 해제하시겠습니까?`,
    confirmText: '해제',
    confirmVariant: 'danger'
  })

  if (!confirmed) return

  try {
    await api.post('/api/v1/auth/unlink-social/', { provider })
    await modal.alert({
      title: '연결 해제 완료',
      description: '소셜 계정 연결이 해제되었습니다.',
      icon: 'success'
    })
    await fetchLinkedAccounts()
  } catch (error: unknown) {
    await modal.alert({
      title: '연결 해제 실패',
      description: getErrorMessage(error, '연결 해제에 실패했습니다.'),
      icon: 'error'
    })
  }
}

const handleSetPassword = async () => {
  passwordError.value = ''

  if (newPassword.value.length < 8) {
    passwordError.value = '비밀번호는 8자 이상이어야 합니다'
    return
  }
  if (!/\d/.test(newPassword.value)) {
    passwordError.value = '비밀번호는 최소 1개의 숫자를 포함해야 합니다'
    return
  }
  if (!/[a-zA-Z]/.test(newPassword.value)) {
    passwordError.value = '비밀번호는 최소 1개의 문자를 포함해야 합니다'
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
      new_password_confirm: newPasswordConfirm.value
    })
    
    await modal.alert({
      title: '비밀번호 설정 완료',
      description: '비밀번호가 성공적으로 설정되었습니다.',
      icon: 'success'
    })
    
    resetPasswordPanel()
    await fetchLinkedAccounts()
  } catch (error: unknown) {
    passwordError.value = getErrorMessage(error, '비밀번호 설정에 실패했습니다.')
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

const handleResendVerification = async () => {
  if (resendingEmail.value || emailCooldown.value > 0) return
  
  resendingEmail.value = true
  try {
    await api.post('/api/v1/auth/resend-verification/')
    await modal.alert({
      title: '인증 메일 발송',
      description: '인증 메일을 발송했습니다. 메일함을 확인해주세요.',
      icon: 'success'
    })
    startEmailCooldown()
  } catch (error: unknown) {
    await modal.alert({
      title: '발송 실패',
      description: getErrorMessage(error, '메일 발송에 실패했습니다.'),
      icon: 'error'
    })
  } finally {
    resendingEmail.value = false
  }
}

const startEmailCooldown = () => {
  emailCooldown.value = 60
  emailCooldownTimer = setInterval(() => {
    emailCooldown.value--
    if (emailCooldown.value <= 0 && emailCooldownTimer) {
      clearInterval(emailCooldownTimer)
      emailCooldownTimer = null
    }
  }, 1000)
}

const handleLogout = async () => {
  const confirmed = await modal.confirm({
    title: '로그아웃',
    description: '정말 로그아웃하시겠습니까?',
    confirmText: '로그아웃',
    confirmVariant: 'danger'
  })

  if (confirmed) {
    const nativeWindow: NativeWindow = window
    if (nativeWindow.ReactNativeWebView) {
      nativeWindow.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestLogout' }))
      return
    }
    await auth.logout()
    navigateTo('/')
  }
}

const handleLogoutAllDevices = async () => {
  const confirmed = await modal.confirm({
    title: '모든 기기에서 로그아웃',
    description: '현재 브라우저를 포함한 모든 기기의 로그인을 종료합니다.',
    confirmText: '로그아웃',
    confirmVariant: 'danger',
    icon: 'warning'
  })

  if (!confirmed) return

  accountActionLoading.value = true
  try {
    await api.post('/api/v1/auth/logout-all/')
    await auth.logout()
    navigateTo('/')
  } catch (error: unknown) {
    await modal.alert({
      title: '로그아웃 실패',
      description: getErrorMessage(error, '모든 기기 로그아웃에 실패했습니다.'),
      icon: 'error'
    })
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

  const confirmed = await modal.confirm({
    title: '계정 삭제',
    description: '정말 계정을 삭제하시겠습니까?\n\n삭제 요청 후 30일간 유예 기간이 있으며, 이 기간 동안 로그인하면 삭제가 취소됩니다. 30일 후에는 모든 데이터가 완전히 삭제되며 복구할 수 없습니다.',
    confirmText: '계정 삭제',
    confirmVariant: 'danger',
    icon: 'warning'
  })

  if (!confirmed) return

  accountActionLoading.value = true
  try {
    await api.post('/api/v1/auth/delete-account/', {
      password: deletePassword.value,
      confirm_delete: true
    })
    await modal.alert({
      title: '계정 삭제 요청 완료',
      description: '계정 삭제가 요청되었습니다. 30일 후 완전히 삭제됩니다.',
      icon: 'success'
    })
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

const buildMergePayload = (keepAccount: KeepAccount) => {
  if (!mergeInfo.value) return null
  const payload: {
    provider: Provider
    code: string
    keep_account: KeepAccount
    id_token?: string
  } = {
    provider: mergeInfo.value.provider,
    code: mergeInfo.value.code,
    keep_account: keepAccount
  }
  if (mergeInfo.value.id_token) {
    payload.id_token = mergeInfo.value.id_token
  }
  return payload
}

const handleBack = () => {
  goBack('/')
}

const handleMerge = async (keepAccount: KeepAccount) => {
  const payload = buildMergePayload(keepAccount)
  if (!payload) return
  
  mergeLoading.value = true
  try {
    const response = await api.post('/api/v1/auth/merge-accounts/', payload)
    
    const data = response
    
    if (keepAccount === 'other' && data.access) {
      auth.setTokens(data.access, data.refresh)
      auth.setUser(data.user)
    }
    
    showMergeModal.value = false
    mergeInfo.value = null
    
    await modal.alert({
      title: '계정 병합 완료',
      description: '계정이 병합되었습니다. 삭제될 계정은 30일 후 완전히 삭제됩니다.',
      icon: 'success'
    })
    
    await fetchLinkedAccounts()
  } catch (error: unknown) {
    await modal.alert({
      title: '병합 실패',
      description: getErrorMessage(error, '계정 병합에 실패했습니다.'),
      icon: 'error'
    })
  } finally {
    mergeLoading.value = false
  }
}

const closeMergeModal = () => {
  showMergeModal.value = false
  mergeInfo.value = null
}

const getProviderDisplayName = (provider: string) => {
  if (isProvider(provider)) {
    return PROVIDER_LABELS[provider]
  }
  return provider
}

const isProvider = (provider: string): provider is Provider => {
  return provider === 'kakao' || provider === 'google' || provider === 'apple'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  if (!auth.isAuthenticated.value) {
    navigateTo('/login')
    return
  }
  
  const route = useRoute()
  
  if (route.query.linked === 'success') {
    const provider = typeof route.query.provider === 'string' ? route.query.provider : ''
    await modal.alert({
      title: '연결 완료',
      description: `${getProviderDisplayName(provider)} 계정이 연결되었습니다.`,
      icon: 'success'
    })
    navigateTo('/account/settings', { replace: true })
  } else if (route.query.linked === 'error') {
    const message = typeof route.query.message === 'string'
      ? route.query.message
      : '계정 연결에 실패했습니다.'
    await modal.alert({
      title: '연결 실패',
      description: message,
      icon: 'error'
    })
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
  
  fetchLinkedAccounts()
})

onUnmounted(() => {
  if (emailCooldownTimer) {
    clearInterval(emailCooldownTimer)
  }
})
</script>

<style scoped>
.settings-container {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  padding-bottom: env(safe-area-inset-bottom);
}

.settings-box {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0 1.5rem;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--color-slate-600);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: var(--color-slate-100);
  color: var(--color-slate-800);
}

.page-title {
  flex: 1;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0;
}

.spacer {
  width: 40px;
}

.settings-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-slate-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
  padding-left: 0.25rem;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px solid var(--color-slate-200);
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  color: var(--primary-color);
  font-size: 1.5rem;
  font-weight: 600;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-nickname {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0 0 0.25rem;
}

.profile-email {
  font-size: 0.875rem;
  color: var(--color-slate-500);
  margin: 0;
}

.section-content {
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px solid var(--color-slate-200);
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--color-slate-100);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-slate-800);
  margin: 0 0 0.25rem;
}

.setting-description {
  font-size: 0.8125rem;
  color: var(--color-slate-500);
  margin: 0;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-slate-800);
  margin-bottom: 0.25rem;
}

.action-button {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--color-slate-300);
  background: var(--color-bg-card);
  color: var(--color-slate-700);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-button:hover:not(:disabled) {
  background: var(--color-slate-100);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  background: var(--primary-dark);
}

.action-button.danger {
  color: var(--color-error);
  border-color: var(--color-error-bg);
}

.action-button.danger:hover:not(:disabled) {
  background: var(--color-error-bg);
}

.section-note {
  font-size: 0.75rem;
  color: var(--color-slate-500);
  margin-top: 0.5rem;
  padding-left: 0.25rem;
}

.verification-item .setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.verification-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.verification-status .setting-label {
  margin: 0;
}

.warning-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-warning);
  flex-shrink: 0;
}

.check-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-success);
  flex-shrink: 0;
}

.verification-status.verified .setting-label {
  color: var(--color-success);
}

.logout-button {
  width: 100%;
  padding: 0.875rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-error);
  background: var(--color-bg-card);
  border: 1px solid var(--color-slate-200);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout-button:hover {
  background: var(--color-error-bg);
  border-color: var(--color-error-bg);
}

.delete-account-button {
  width: 100%;
  padding: 0.875rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-error);
  background: var(--color-bg-card);
  border: 1px solid var(--color-error-bg);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-account-button:hover {
  background: var(--color-error-bg);
  border-color: var(--color-error);
}

.danger-note {
  color: var(--color-error);
}

.inline-sensitive-form,
.danger-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  padding-top: 0.25rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0 0 1.5rem;
}

.inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.action-button.danger.solid {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.action-button.danger.solid:hover:not(:disabled) {
  background: var(--color-error-dark, #b91c1c);
  border-color: var(--color-error-dark, #b91c1c);
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.input-wrapper label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-slate-600);
}

.input-wrapper input {
  padding: 0.75rem;
  border: 1px solid var(--color-slate-300);
  border-radius: 8px;
  font-size: 0.9375rem;
  background: var(--color-bg-primary);
  color: var(--color-slate-800);
}

.input-wrapper input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.error-text {
  font-size: 0.8125rem;
  color: var(--color-error);
  margin: 0;
}
[data-theme="dark"] .back-btn:hover {
  background: var(--color-slate-700);
}

[data-theme="dark"] .page-title,
[data-theme="dark"] .profile-nickname,
[data-theme="dark"] .setting-label,
[data-theme="dark"] .provider-badge,
[data-theme="dark"] .modal-title {
  color: var(--color-text-primary);
}

[data-theme="dark"] .profile-email,
[data-theme="dark"] .setting-description,
[data-theme="dark"] .section-note {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .profile-card,
[data-theme="dark"] .section-content,
[data-theme="dark"] .logout-button {
  background: var(--color-bg-card);
  border: none;
  box-shadow: none;
}

[data-theme="dark"] .setting-item {
  border-color: var(--color-border-light, rgba(255, 255, 255, 0.1));
}

[data-theme="dark"] .action-button {
  background: var(--color-bg-secondary);
  border-color: var(--color-slate-600);
  color: var(--color-slate-300);
}

[data-theme="dark"] .action-button:hover:not(:disabled) {
  background: var(--color-slate-700);
}

[data-theme="dark"] .input-wrapper input {
  background: var(--color-bg-primary);
  border-color: var(--color-slate-600);
  color: var(--color-slate-100);
}

.merge-modal-content {
  background: var(--color-bg-card);
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.merge-description {
  font-size: 0.9375rem;
  color: var(--color-slate-600);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.merge-accounts {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.account-card {
  position: relative;
  padding: 1rem;
  border: 2px solid var(--color-slate-200);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.account-card:hover {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.account-badge {
  position: absolute;
  top: -10px;
  left: 12px;
  padding: 2px 8px;
  background: var(--primary-color);
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
}

.account-badge.other {
  background: var(--color-slate-500);
}

.account-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-info {
  margin-bottom: 0.75rem;
}

.account-nickname {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-slate-800);
  margin: 0 0 0.25rem;
}

.account-email {
  font-size: 0.8125rem;
  color: var(--color-slate-500);
  margin: 0 0 0.5rem;
}

.account-providers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0 0 0.5rem;
}

.provider-tag {
  display: inline-block;
  padding: 2px 6px;
  background: var(--color-slate-100);
  color: var(--color-slate-600);
  font-size: 0.6875rem;
  border-radius: 4px;
}

.provider-tag.password {
  background: #dbeafe;
  color: #1d4ed8;
}

.account-date {
  font-size: 0.75rem;
  color: var(--color-slate-400);
  margin: 0;
}

.select-btn {
  width: 100%;
  padding: 0.625rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.select-btn:hover:not(:disabled) {
  background: var(--primary-dark);
}

.select-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.merge-warning {
  font-size: 0.8125rem;
  color: var(--color-error);
  background: var(--color-error-bg);
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.btn-cancel-full {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-slate-100);
  border: 1px solid var(--color-slate-200);
  color: var(--color-slate-700);
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-cancel-full:hover:not(:disabled) {
  background: var(--color-slate-200);
}

.btn-cancel-full:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

[data-theme="dark"] .merge-modal-content {
  background: var(--color-bg-secondary);
}

[data-theme="dark"] .merge-description {
  color: var(--color-slate-400);
}

[data-theme="dark"] .account-card {
  border-color: var(--color-slate-600);
  background: var(--color-bg-primary);
}

[data-theme="dark"] .account-card:hover {
  border-color: var(--primary-color);
  background: var(--color-slate-700);
}

[data-theme="dark"] .account-nickname {
  color: var(--color-slate-100);
}

[data-theme="dark"] .provider-tag {
  background: var(--color-slate-700);
  color: var(--color-slate-300);
}

[data-theme="dark"] .merge-warning {
  background: rgba(220, 38, 38, 0.1);
}

[data-theme="dark"] .btn-cancel-full {
  background: var(--color-slate-700);
  border-color: var(--color-slate-600);
  color: var(--color-slate-300);
}

@media (max-width: 640px) {
  .settings-box {
    padding: 0.75rem;
  }
  
  .merge-modal-content {
    padding: 1rem;
    max-width: calc(100% - 2rem);
  }
}
</style>
