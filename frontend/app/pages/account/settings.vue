<template>
  <PageLayout title="계정 설정" :on-back="handleBack" :show-floating-nav="false">
    <div class="account-settings-page">
      <!-- 프로필 요약 -->
      <section class="profile-hero fade-in">
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
        <div class="profile-summary">
          <p class="eyebrow">내 계정</p>
          <h2>{{ user?.nickname || '사용자' }}</h2>
          <p>{{ linkedAccounts?.email || user?.email || '이메일 없음' }}</p>
        </div>
      </section>

      <!-- 로그인 방법 요약 -->
      <section class="summary-grid fade-in delay-100" aria-label="로그인 방법 요약">
        <div class="summary-card">
          <span class="summary-label">로그인 방법</span>
          <strong>{{ linkedAccounts?.auth_methods?.total ?? '-' }}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">소셜 연결</span>
          <strong>{{ linkedAccounts?.auth_methods?.social_count ?? linkedAccounts?.linked_accounts.length ?? 0 }}</strong>
        </div>
        <div class="summary-card">
          <span class="summary-label">비밀번호</span>
          <strong>{{ linkedAccounts?.has_password ? '설정됨' : '미설정' }}</strong>
        </div>
      </section>

      <!-- 이메일/비밀번호 -->
      <section class="settings-card fade-in delay-150">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Login security</p>
            <h3>이메일 · 비밀번호</h3>
          </div>
        </div>

        <div v-if="user?.email && user?.has_usable_password_flag">
          <div v-if="!user?.email_verified" class="setting-row highlight warning">
            <div class="row-icon warning">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="setting-info">
              <p class="setting-label">이메일 인증 필요</p>
              <p class="setting-description">{{ user?.email }}로 인증 메일을 발송합니다</p>
            </div>
            <button
              @click="handleResendVerification"
              class="btn btn-primary"
              :disabled="resendingEmail || emailCooldown > 0"
            >
              {{ emailButtonText }}
            </button>
          </div>

          <div v-else class="setting-row highlight success">
            <div class="row-icon success">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="setting-info">
              <p class="setting-label">이메일 인증 완료</p>
              <p class="setting-description">{{ user?.email }}</p>
            </div>
          </div>
        </div>

        <div class="setting-row password-row">
          <div class="row-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div class="setting-info">
            <p class="setting-label">비밀번호 설정</p>
            <p class="setting-description">
              {{ linkedAccounts?.has_password ? '비밀번호가 설정되어 있습니다' : '이메일 로그인을 위해 비밀번호를 설정하세요' }}
            </p>
          </div>
          <button @click="showPasswordPanel = !showPasswordPanel" class="btn btn-secondary">
            {{ showPasswordPanel ? '닫기' : (linkedAccounts?.has_password ? '변경' : '설정') }}
          </button>
        </div>

        <form v-if="showPasswordPanel" @submit.prevent="handleSetPassword" class="inline-form">
          <div v-if="linkedAccounts?.has_password" class="input-wrapper">
            <label for="current-password">현재 비밀번호</label>
            <input id="current-password" v-model="currentPassword" type="password" placeholder="현재 비밀번호" autocomplete="current-password">
          </div>
          <div class="input-wrapper">
            <label for="new-password">새 비밀번호</label>
            <input id="new-password" v-model="newPassword" type="password" placeholder="8자 이상 (문자+숫자)" autocomplete="new-password">
          </div>
          <div class="input-wrapper">
            <label for="new-password-confirm">비밀번호 확인</label>
            <input id="new-password-confirm" v-model="newPasswordConfirm" type="password" placeholder="비밀번호 재입력" autocomplete="new-password">
          </div>
          <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="resetPasswordPanel">취소</button>
            <button type="submit" class="btn btn-primary" :disabled="passwordLoading">
              {{ passwordLoading ? '처리 중...' : '저장' }}
            </button>
          </div>
        </form>
      </section>

      <!-- 연결된 계정 -->
      <section class="settings-card fade-in delay-300">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Linked accounts</p>
            <h3>연결된 계정</h3>
          </div>
        </div>

        <SkeletonList v-if="loading" :count="3" variant="user" />
        <div v-else class="linked-list">
          <div v-for="provider in PROVIDERS" :key="provider" class="setting-row">
            <div class="provider-icon" :class="provider">
              <NuxtImg
                v-if="provider === 'kakao'"
                src="/images/kakao.png"
                width="18"
                height="18"
                alt="카카오"
                loading="lazy"
                format="webp"
              />
              <svg v-if="provider === 'google'" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <svg v-if="provider === 'apple'" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            </div>
            <div class="setting-info">
              <p class="setting-label">{{ getProviderDisplayName(provider) }}</p>
              <p class="setting-description">{{ getLinkedAccount(provider)?.email || (isProviderLinked(provider) ? '연결됨' : '연결되지 않음') }}</p>
            </div>
            <button v-if="isProviderLinked(provider)" @click="handleUnlink(provider)" class="btn btn-danger-ghost" :disabled="!canUnlink(provider)">해제</button>
            <button v-else @click="handleLinkProvider(provider)" class="btn btn-primary" :disabled="linkingProvider === provider">
              {{ linkingProvider === provider ? '연결 중...' : '연결' }}
            </button>
          </div>
        </div>

        <p class="section-note">최소 하나의 로그인 방법(비밀번호 또는 소셜 계정)이 있어야 합니다.</p>
      </section>

      <!-- 세션 관리 -->
      <section class="settings-card fade-in delay-400">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Session</p>
            <h3>로그인 세션</h3>
          </div>
        </div>

        <div class="button-stack">
          <button @click="handleLogout" class="wide-action">로그아웃</button>
          <button @click="handleLogoutAllDevices" class="wide-action" :disabled="accountActionLoading">
            모든 기기에서 로그아웃
          </button>
        </div>
        <p class="section-note">현재 브라우저를 포함한 모든 기기의 로그인 세션을 종료할 수 있습니다.</p>
      </section>

      <!-- 알림 설정 -->
      <section class="settings-card fade-in delay-450">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Notifications</p>
            <h3>알림 설정</h3>
          </div>
        </div>

        <div class="setting-row">
          <div class="row-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div class="setting-info">
            <p class="setting-label">알림 설정</p>
            <p class="setting-description">통독, 하세나하시조, 친구 활동 알림을 관리합니다</p>
          </div>
          <button @click="navigateTo('/notifications/settings')" class="btn btn-secondary">열기</button>
        </div>
      </section>

      <!-- 계정 삭제 -->
      <section class="settings-card danger-card fade-in delay-500">
        <div class="section-heading">
          <div>
            <p class="eyebrow danger">Danger zone</p>
            <h3>계정 삭제</h3>
          </div>
        </div>

        <p class="danger-copy">계정 삭제 요청 후 30일간 유예 기간이 있으며, 이후 완전히 삭제됩니다.</p>
        <button @click="showDeletePanel = !showDeletePanel" class="wide-action danger">
          {{ showDeletePanel ? '계정 삭제 닫기' : '계정 삭제' }}
        </button>

        <form v-if="showDeletePanel" @submit.prevent="handleDeleteAccount" class="inline-form danger-form">
          <div v-if="linkedAccounts?.has_password" class="input-wrapper">
            <label for="delete-password">계정 비밀번호</label>
            <input id="delete-password" v-model="deletePassword" type="password" placeholder="계정 비밀번호" autocomplete="current-password">
          </div>
          <p v-else class="setting-description">계정 삭제는 보안을 위해 비밀번호 설정 후 진행할 수 있습니다.</p>
          <p class="setting-description">삭제 요청 후 30일 안에 다시 로그인하면 삭제가 취소됩니다. 30일 이후에는 복구할 수 없습니다.</p>
          <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="resetDeletePanel">취소</button>
            <button type="submit" class="btn btn-danger" :disabled="accountActionLoading || !linkedAccounts?.has_password">
              {{ accountActionLoading ? '처리 중...' : '삭제 요청' }}
            </button>
          </div>
        </form>
      </section>

      <!-- 계정 병합 -->
      <section v-if="showMergeModal && mergeInfo" class="settings-card merge-prompt-card fade-in delay-600">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Account merge</p>
            <h3>기존 계정 병합</h3>
          </div>
        </div>
        <p class="setting-description">
          연결하려는 {{ getProviderDisplayName(mergeInfo.provider) }} 계정이 이미 다른 매일일독 계정에 연결되어 있습니다.
          유지할 계정을 선택해 병합을 진행하세요.
        </p>
        <button class="wide-action primary" @click="showMergeConfirmModal = true">
          병합 계정 선택하기
        </button>
      </section>

      <section v-if="showMergeConfirmModal && mergeInfo" class="merge-overlay">
        <div class="merge-modal-content">
          <h3 class="modal-title">계정 병합</h3>
          <p class="merge-description">
            이 {{ getProviderDisplayName(mergeInfo.provider) }} 계정은 다른 매일일독 계정에 연결되어 있습니다.<br>
            <strong>어느 계정을 유지하시겠습니까?</strong>
          </p>

          <div class="merge-accounts">
            <div class="account-card" @click="handleMerge('current')">
              <div class="account-badge">현재 로그인</div>
              <div class="account-avatar">
                <NuxtImg v-if="mergeInfo.current_account.profile_image" :src="mergeInfo.current_account.profile_image" alt="" loading="lazy" />
                <div v-else class="avatar-placeholder">{{ mergeInfo.current_account.nickname?.charAt(0) || '?' }}</div>
              </div>
              <div class="account-info">
                <p class="account-nickname">{{ mergeInfo.current_account.nickname }}</p>
                <p class="account-email">{{ mergeInfo.current_account.email || '이메일 없음' }}</p>
                <p class="account-providers">
                  <span v-for="p in mergeInfo.current_account.providers" :key="p" class="provider-tag">{{ getProviderDisplayName(p) }}</span>
                  <span v-if="mergeInfo.current_account.has_password" class="provider-tag password">비밀번호</span>
                </p>
                <p class="account-date">가입: {{ formatDate(mergeInfo.current_account.created_at) }}</p>
              </div>
              <button class="select-btn" :disabled="mergeLoading" @click.stop="handleMerge('current')">이 계정 유지</button>
            </div>

            <div class="account-card" @click="handleMerge('other')">
              <div class="account-badge other">{{ getProviderDisplayName(mergeInfo.provider) }} 연결 계정</div>
              <div class="account-avatar">
                <NuxtImg v-if="mergeInfo.other_account.profile_image" :src="mergeInfo.other_account.profile_image" alt="" loading="lazy" />
                <div v-else class="avatar-placeholder">{{ mergeInfo.other_account.nickname?.charAt(0) || '?' }}</div>
              </div>
              <div class="account-info">
                <p class="account-nickname">{{ mergeInfo.other_account.nickname }}</p>
                <p class="account-email">{{ mergeInfo.other_account.email || '이메일 없음' }}</p>
                <p class="account-providers">
                  <span v-for="p in mergeInfo.other_account.providers" :key="p" class="provider-tag">{{ getProviderDisplayName(p) }}</span>
                  <span v-if="mergeInfo.other_account.has_password" class="provider-tag password">비밀번호</span>
                </p>
                <p class="account-date">가입: {{ formatDate(mergeInfo.other_account.created_at) }}</p>
              </div>
              <button class="select-btn" :disabled="mergeLoading" @click.stop="handleMerge('other')">이 계정 유지</button>
            </div>
          </div>

          <p class="merge-warning">
            선택하지 않은 계정은 30일 후 완전히 삭제됩니다.<br>
            해당 계정의 소셜 연결만 유지 계정으로 이전됩니다.
          </p>

          <button class="btn-cancel-full" @click="closeMergeModal" :disabled="mergeLoading">취소</button>
        </div>
      </section>
    </div>
  </PageLayout>
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
import PageLayout from '~/components/common/PageLayout.vue'
import { buildOAuthLinkUrl, buildSocialMergePayload } from '~/utils/accountSettingsRuntime.js'

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
  merge_token?: string
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
  google: 'Google',
  apple: 'Apple',
}
const PROVIDERS: Provider[] = ['kakao', 'google', 'apple']

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
const showMergeConfirmModal = ref(false)
const mergeInfo = ref<MergeInfo | null>(null)
const mergeLoading = ref(false)
const linkingProvider = ref<Provider | null>(null)

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
    merge_token: getString(payload, 'merge_token') || undefined,
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

const getOAuthProviderConfig = (provider: Provider) => {
  const providerConfig = {
    kakao: {
      clientId: config.public.KAKAO_CLIENT_ID,
      redirectUri: config.public.KAKAO_REDIRECT_URI,
      baseUrl: 'https://kauth.kakao.com/oauth/authorize',
    },
    google: {
      clientId: config.public.GOOGLE_CLIENT_ID,
      redirectUri: config.public.GOOGLE_REDIRECT_URI,
      baseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'email profile',
    },
    apple: {
      clientId: config.public.APPLE_CLIENT_ID,
      redirectUri: config.public.APPLE_REDIRECT_URI || `${window.location.origin}/auth/apple/callback`,
      baseUrl: 'https://appleid.apple.com/auth/authorize',
      scope: 'name email',
    },
  }
  return providerConfig[provider]
}

const handleLinkProvider = async (provider: Provider) => {
  const providerConfig = getOAuthProviderConfig(provider)
  const { clientId, redirectUri } = providerConfig
  if (!clientId || !redirectUri) {
    await modal.alert({
      title: '연결 설정이 필요합니다',
      description: `${getProviderDisplayName(provider)} 로그인 설정을 확인해주세요.`,
      icon: 'error',
    })
    return
  }

  linkingProvider.value = provider
  try {
    const state = await getOAuthLinkState()
    const authUrl = buildOAuthLinkUrl(provider, providerConfig, state)
    window.location.assign(authUrl)
  } catch (error: unknown) {
    await modal.alert({
      title: '계정 연결 실패',
      description: getErrorMessage(error, '소셜 계정 연결을 시작하지 못했습니다.'),
      icon: 'error',
    })
    linkingProvider.value = null
  }
}

const handleLinkGoogle = () => handleLinkProvider('google')

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

const handleBack = () => {
  goBack('/')
}

const handleMerge = async (keepAccount: KeepAccount) => {
  if (!mergeInfo.value) return
  const payload = buildSocialMergePayload(mergeInfo.value, keepAccount)
  
  mergeLoading.value = true
  try {
    const response = await api.post('/api/v1/auth/merge-accounts/', payload)
    
    const data = response
    
    if (keepAccount === 'other' && data.access) {
      auth.setTokens(data.access, data.refresh)
      auth.setUser(data.user)
    }
    
    showMergeModal.value = false
    showMergeConfirmModal.value = false
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
  showMergeConfirmModal.value = false
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
      showMergeConfirmModal.value = false
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
.account-settings-page {
  min-height: calc(100vh - 50px);
  padding: 1rem;
  padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--background-color, var(--color-bg-primary));
}

.profile-hero,
.settings-card,
.summary-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default, var(--color-slate-200));
  border-radius: 18px;
  box-shadow: var(--shadow-sm);
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent-primary, #4A5D53) 10%, transparent), transparent 55%),
    var(--color-bg-card);
}

.profile-avatar,
.account-avatar {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-accent-primary-light, #E8ECE9);
}

.profile-avatar img,
.account-avatar img {
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
  background: var(--color-accent-primary-light, #E8ECE9);
  color: var(--color-accent-primary, #4A5D53);
  font-size: 1.4rem;
  font-weight: 700;
}

.profile-summary {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent-primary, #4A5D53);
}

.eyebrow.danger {
  color: var(--color-error);
}

.profile-summary h2,
.section-heading h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-weight: 700;
}

.profile-summary h2 {
  font-size: 1.35rem;
}

.profile-summary p:last-child {
  margin: 0.25rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.summary-card {
  padding: 0.9rem;
}

.summary-label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.summary-card strong {
  color: var(--color-text-primary);
  font-size: 1.05rem;
}

.settings-card {
  padding: 1rem;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.section-heading h3 {
  font-size: 1rem;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 0;
  border-bottom: 1px solid var(--color-border-light, rgba(0, 0, 0, 0.06));
}

.setting-row:first-child {
  padding-top: 0.25rem;
}

.setting-row:last-child {
  border-bottom: 0;
  padding-bottom: 0.25rem;
}

.setting-row.highlight {
  margin-top: 0.25rem;
  padding: 0.875rem;
  border: 1px solid transparent;
  border-radius: 14px;
}

.setting-row.highlight.warning {
  background: color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-warning, #f59e0b) 24%, transparent);
}

.setting-row.highlight.success {
  background: color-mix(in srgb, var(--color-success, #16a34a) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-success, #16a34a) 22%, transparent);
}

.row-icon,
.provider-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.row-icon svg,
.provider-icon svg {
  width: 19px;
  height: 19px;
}

.row-icon.warning { color: var(--color-warning, #f59e0b); }
.row-icon.success { color: var(--color-success, #16a34a); }
.provider-icon.kakao { background: #FEE500; color: #181600; }
.provider-icon.google { background: var(--color-bg-secondary); }
.provider-icon.apple { background: var(--color-text-primary); color: var(--color-bg-card); }

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  margin: 0 0 0.2rem;
  color: var(--color-text-primary);
  font-size: 0.94rem;
  font-weight: 650;
}

.setting-description,
.section-note,
.danger-copy {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.section-note {
  margin-top: 0.75rem;
}

.btn,
.wide-action,
.select-btn,
.btn-cancel-full {
  border: 0;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}

.btn:hover:not(:disabled),
.wide-action:hover:not(:disabled),
.select-btn:hover:not(:disabled),
.btn-cancel-full:hover:not(:disabled) {
  transform: translateY(-1px);
}

.btn:disabled,
.wide-action:disabled,
.select-btn:disabled,
.btn-cancel-full:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn {
  padding: 0.56rem 0.85rem;
}

.btn-primary,
.select-btn {
  background: var(--color-accent-primary, #4A5D53);
  color: var(--color-text-inverse, #fff);
}

.btn-secondary,
.btn-cancel-full {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.btn-danger,
.wide-action.primary {
  background: var(--color-accent-primary, #4A5D53);
  color: var(--color-text-inverse, #fff);
  border-color: var(--color-accent-primary, #4A5D53);
}

.wide-action.danger {
  background: var(--color-error);
  color: var(--color-text-inverse, #fff);
}

.btn-danger-ghost {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.linked-list {
  display: flex;
  flex-direction: column;
}

.inline-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  margin-top: 0.75rem;
  background: var(--color-bg-secondary);
  border-radius: 14px;
  border: 1px solid var(--color-border-light, rgba(0, 0, 0, 0.06));
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.input-wrapper label {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 650;
}

.input-wrapper input {
  width: 100%;
  padding: 0.78rem 0.85rem;
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: 0.94rem;
}

.input-wrapper input:focus {
  outline: none;
  border-color: var(--color-accent-primary, #4A5D53);
  box-shadow: 0 0 0 3px var(--color-accent-primary-light, #E8ECE9);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.error-text {
  margin: 0;
  color: var(--color-error);
  font-size: 0.82rem;
}

.button-stack {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.wide-action {
  width: 100%;
  padding: 0.82rem 1rem;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
}

.merge-prompt-card .wide-action {
  margin-top: 0.85rem;
}

.danger-card {
  border-color: color-mix(in srgb, var(--color-error) 24%, var(--color-border-default));
}

.danger-copy {
  margin-bottom: 0.75rem;
  color: var(--color-error);
}

.danger-form {
  background: color-mix(in srgb, var(--color-error-bg) 45%, var(--color-bg-secondary));
}

.merge-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
}

.merge-modal-content {
  width: min(100%, 540px);
  max-height: min(90vh, 720px);
  overflow-y: auto;
  background: var(--color-bg-card);
  border-radius: 20px;
  padding: 1.25rem;
  box-shadow: var(--shadow-lg, 0 20px 45px rgba(0, 0, 0, 0.18));
}

.modal-title {
  margin: 0 0 0.75rem;
  color: var(--color-text-primary);
  font-size: 1.15rem;
  font-weight: 700;
}

.merge-description {
  margin: 0 0 1.25rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.merge-accounts {
  display: grid;
  gap: 1rem;
}

.account-card {
  position: relative;
  padding: 1rem;
  border: 1.5px solid var(--color-border-default);
  border-radius: 16px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.account-card:hover {
  transform: translateY(-1px);
  border-color: var(--color-accent-primary, #4A5D53);
  background: var(--color-accent-primary-light, #E8ECE9);
}

.account-badge {
  display: inline-flex;
  margin-bottom: 0.75rem;
  padding: 0.24rem 0.5rem;
  border-radius: 999px;
  background: var(--color-accent-primary, #4A5D53);
  color: var(--color-text-inverse, #fff);
  font-size: 0.72rem;
  font-weight: 700;
}

.account-badge.other {
  background: var(--color-text-muted);
}

.account-avatar {
  width: 48px;
  height: 48px;
  margin-bottom: 0.75rem;
}

.account-nickname,
.account-email,
.account-providers,
.account-date {
  margin: 0;
}

.account-nickname {
  color: var(--color-text-primary);
  font-weight: 700;
}

.account-email,
.account-date {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.account-providers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.5rem 0;
}

.provider-tag {
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 650;
}

.provider-tag.password {
  background: var(--color-accent-primary-light, #E8ECE9);
  color: var(--color-accent-primary, #4A5D53);
}

.select-btn,
.btn-cancel-full {
  width: 100%;
  padding: 0.75rem;
  margin-top: 0.85rem;
}

.merge-warning {
  margin: 1rem 0 0;
  padding: 0.8rem;
  border-radius: 12px;
  color: var(--color-error);
  background: var(--color-error-bg);
  font-size: 0.82rem;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .account-settings-page {
    padding: 0.75rem;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .summary-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .setting-row {
    gap: 0.65rem;
  }

  .button-stack {
    grid-template-columns: 1fr;
  }

  .btn {
    padding-inline: 0.72rem;
  }
}
</style>
