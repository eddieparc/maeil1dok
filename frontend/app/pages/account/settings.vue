<template>
  <PageLayout title="계정 설정" :on-back="handleBack">
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
          <h2>{{ user?.nickname || '사용자' }}</h2>
          <p>{{ linkedAccounts?.email || user?.email || '이메일 없음' }}</p>
        </div>
        <AppButton variant="secondary" size="sm" :loading="profileEditLoading" @click="handleEditProfile">편집</AppButton>
      </section>

      <section class="settings-group notification-group" aria-labelledby="notification-heading">
        <div class="group-heading">
          <h3 id="notification-heading" class="group-label">알림</h3>
          <NuxtLink to="/notifications/settings" class="text-action" aria-label="알림 설정">상세 설정</NuxtLink>
        </div>
        <ListCard :padded="false">
          <div v-for="item in notificationRows" :key="item.key" class="list-card-row setting-row">
            <div class="setting-info">
              <p :id="`${item.key}-label`" class="setting-label">{{ item.label }}</p>
              <p :id="`${item.key}-description`" class="setting-description">{{ item.description }}</p>
            </div>
            <button
              type="button"
              class="switch-hit"
              role="switch"
              :aria-checked="Boolean(notificationSettings?.notifications_enabled && notificationSettings[item.key])"
              :aria-labelledby="`${item.key}-label`"
              :aria-describedby="`${item.key}-description`"
              :disabled="!notificationSettings || notificationsBusy"
              @click="toggleNotification(item.key)"
            >
              <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
            </button>
          </div>
        </ListCard>
        <div v-if="notificationError" class="notification-error" role="alert">
          <p class="error-text">{{ notificationError }}</p>
          <AppButton v-if="!notificationSettings" variant="ghost" size="sm" @click="notificationsStore.fetchSettings()">다시 시도</AppButton>
        </div>
      </section>

      <section class="settings-group account-group" aria-labelledby="account-heading">
        <h3 id="account-heading" class="group-label">계정</h3>
        <ListCard :padded="false">
          <SkeletonList v-if="loading" :count="3" variant="user" />
          <div v-else class="linked-list">
            <div v-for="provider in PROVIDERS" :key="provider" class="list-card-row setting-row">
              <div class="provider-icon" :class="provider">
                <MessageCircle v-if="provider === 'kakao'" :size="18" aria-hidden="true" />
                <Globe v-else-if="provider === 'google'" :size="18" aria-hidden="true" />
                <Apple v-else :size="18" aria-hidden="true" />
              </div>
              <div class="setting-info">
                <p class="setting-label">{{ getProviderDisplayName(provider) }}</p>
              </div>
              <span v-if="isProviderLinked(provider)" class="connected-badge">연결됨</span>
              <button v-if="isProviderLinked(provider)" type="button" @click="handleUnlink(provider)" class="text-action unlink-action" :disabled="!canUnlink(provider)">해제</button>
              <button v-else type="button" @click="handleLinkProvider(provider)" class="connect-action" :disabled="linkingProvider !== null">
                <span>{{ linkingProvider === provider ? '연결 중...' : '연결' }}</span>
              </button>
            </div>
          </div>
          <button type="button" class="list-card-row setting-row row-action" :disabled="loading" :aria-expanded="showPasswordPanel" @click="handlePasswordAction">
            <span class="setting-info setting-label">비밀번호</span>
            <span class="setting-description">{{ linkedAccounts?.has_password ? '설정됨' : '미설정' }}</span>
            <ChevronRight :size="18" class="chevron" aria-hidden="true" />
          </button>

        <div v-if="user?.email && user?.has_usable_password_flag">
          <div v-if="!user?.email_verified" class="setting-row highlight warning">
            <div class="row-icon"><Mail :size="18" aria-hidden="true" /></div>
            <div class="setting-info">
              <p class="setting-label">이메일 인증 필요</p>
              <p class="setting-description">{{ user?.email }}로 인증 메일을 발송합니다</p>
            </div>
            <AppButton variant="secondary" size="sm" @click="handleResendVerification" :disabled="resendingEmail || emailCooldown > 0">{{ emailButtonText }}</AppButton>
          </div>

          <div v-else class="setting-row highlight success">
            <div class="row-icon"><CheckCircle :size="18" aria-hidden="true" /></div>
            <div class="setting-info">
              <p class="setting-label">이메일 인증 완료</p>
              <p class="setting-description">{{ user?.email }}</p>
            </div>
          </div>
        </div>

        <form v-if="showPasswordPanel && linkedAccounts?.has_password" @submit.prevent="handleSetPassword" class="inline-form">
          <div class="input-wrapper">
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
            <AppButton variant="secondary" size="sm" @click="resetPasswordPanel">취소</AppButton>
            <AppButton type="submit" size="sm" :loading="passwordLoading">저장</AppButton>
          </div>
        </form>
        </ListCard>
        <p class="section-note">최소 하나의 로그인 방법(비밀번호 또는 소셜 계정)이 있어야 합니다.</p>
      </section>

      <section class="settings-group display-group" aria-labelledby="display-heading">
        <h3 id="display-heading" class="group-label">화면</h3>
        <ListCard :padded="false">
          <div class="list-card-row theme-row">
            <p class="setting-label">테마</p>
            <SegmentedControl v-model="selectedTheme" :options="themeOptions" aria-label="테마" />
          </div>
          <button type="button" class="list-card-row setting-row row-action" @click="isReadingSettingsOpen = true">
            <div class="setting-info">
              <p class="setting-label">읽기 설정</p>
              <p class="setting-description">글꼴 · 크기 · 줄 간격</p>
            </div>
            <ChevronRight :size="18" class="chevron" aria-hidden="true" />
          </button>
        </ListCard>
      </section>

      <section class="account-actions" aria-label="로그인 세션 및 계정 삭제">
        <div class="footer-links">
          <button type="button" @click="handleLogout" class="text-action">로그아웃</button>
          <button type="button" @click="showDeletePanel = !showDeletePanel" class="text-action danger" :aria-expanded="showDeletePanel">
            {{ showDeletePanel ? '계정 삭제 닫기' : '계정 삭제' }}
          </button>
        </div>
        <button type="button" @click="handleLogoutAllDevices" class="text-action all-devices" :disabled="accountActionLoading">모든 기기에서 로그아웃</button>

        <form v-if="showDeletePanel" @submit.prevent="handleDeleteAccount" class="inline-form danger-form">
          <div v-if="linkedAccounts?.has_password" class="input-wrapper">
            <label for="delete-password">계정 비밀번호</label>
            <input id="delete-password" v-model="deletePassword" type="password" placeholder="계정 비밀번호" autocomplete="current-password">
          </div>
          <p v-else class="setting-description">계정 삭제는 보안을 위해 비밀번호 설정 후 진행할 수 있습니다.</p>
          <p class="setting-description">삭제 요청 후 30일 안에 다시 로그인하면 삭제가 취소됩니다. 30일 이후에는 복구할 수 없습니다.</p>
          <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
          <div class="form-actions">
            <AppButton variant="secondary" size="sm" @click="resetDeletePanel">취소</AppButton>
            <AppButton type="submit" variant="danger" size="sm" :loading="accountActionLoading" :disabled="!linkedAccounts?.has_password">삭제 요청</AppButton>
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
            <div class="account-card">
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

            <div class="account-card">
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

      <ReadingSettingsSheet v-model="isReadingSettingsOpen" />
      <ProfileEditModal v-if="showProfileEdit && editableProfile" :profile="editableProfile" @close="showProfileEdit = false" />
      <p v-if="shellIdentity.visible" class="shell-identity">{{ shellIdentity.label }}</p>
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
import { classifyShellIdentity } from '~/composables/shellBundleIdentity'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'
import ListCard from '~/components/ui/ListCard.vue'
import SegmentedControl from '~/components/ui/SegmentedControl.vue'
import ProfileEditModal from '~/components/profile/ProfileEditModal.vue'
import ReadingSettingsSheet from '~/components/ReadingSettingsSheet.vue'
import { Apple, CheckCircle, ChevronRight, Globe, Mail, MessageCircle } from '@lucide/vue'
import { useNotificationsStore, type NotificationSettings } from '~/stores/notifications'
import { useReadingSettingsStore } from '~/stores/readingSettings'
import { useProfileStore } from '~/stores/profile'
import {
  buildDeleteAccountPayload,
  buildNativeAppleLinkRequest,
  buildOAuthLinkUrl,
  buildSocialMergePayload,
  getProviderDisplayName,
  parseNativeAppleLinkResult,
  shouldUseNativeAppleLink,
} from '~/utils/accountSettingsRuntime.js'
import { resolveSocialRedirectUri } from '#shared/utils/authCallbackRuntime'

useHead({
  title: '계정 설정 - 매일일독',
})

const auth = useAuthService()
const modal = useModal()
const api = useApi()
const config = useRuntimeConfig()
const { goBack } = useNavigation()
const notificationsStore = useNotificationsStore()
const readingSettings = useReadingSettingsStore()
const isReadingSettingsOpen = ref(false)
const profileStore = useProfileStore()

const themeOptions = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템' },
]
const selectedTheme = computed<string | number>({
  get: () => readingSettings.settings.theme,
  set: value => readingSettings.updateSetting('theme', value as 'light' | 'dark' | 'system'),
})

type NotificationToggle = 'reading_reminders_enabled' | 'hasena_reminders_enabled' | 'friend_activity_enabled'
const notificationSettings = computed(() => notificationsStore.settings)
const notificationsBusy = computed(() => notificationsStore.isLoading || notificationsStore.isSaving)
const notificationError = computed(() => notificationsStore.error)
const readingReminderDescription = computed(() => {
  const time = notificationSettings.value?.reading_reminder_time
  if (!time) return '매일 아침 6시'
  const [hours, minutes] = time.split(':').map(Number)
  return `매일 ${hours! < 12 ? '아침' : '오후'} ${hours! % 12 || 12}시${minutes ? ` ${minutes}분` : ''}`
})
const notificationRows = computed<Array<{ key: NotificationToggle; label: string; description: string }>>(() => [
  { key: 'reading_reminders_enabled', label: '오늘 본문 알림', description: readingReminderDescription.value },
  { key: 'hasena_reminders_enabled', label: '하세나하시조 알림', description: '오늘의 묵상 시간을 알려드려요' },
  { key: 'friend_activity_enabled', label: '친구 활동', description: '친구의 통독과 하세나 소식' },
])
const toggleNotification = async (key: NotificationToggle) => {
  const settings = notificationSettings.value
  if (!settings || notificationsBusy.value) return
  const enabled = !(settings.notifications_enabled && settings[key])
  const patch: Partial<NotificationSettings> = { [key]: enabled }
  if (enabled && !settings.notifications_enabled) {
    // Turning on one category must not re-enable other categories disabled by the master switch.
    Object.assign(patch, {
      notifications_enabled: true,
      reading_reminders_enabled: false,
      hasena_reminders_enabled: false,
      friend_activity_enabled: false,
      [key]: true,
    })
  }
  await notificationsStore.updateSettings(patch)
}

const showProfileEdit = ref(false)
const profileEditLoading = computed(() => profileStore.isLoading)
const editableProfile = computed(() => profileStore.currentProfile)
const handleEditProfile = async () => {
  if (!auth.user.value || profileEditLoading.value) return
  await profileStore.fetchProfile(auth.user.value.id)
  if (profileStore.error) {
    await modal.alert({ title: '프로필을 불러오지 못했습니다', description: profileStore.error, icon: 'error' })
    return
  }
  showProfileEdit.value = true
}

/**
 * Which shell bundle is this running inside. Read on mount rather than during SSR:
 * the answer lives on `window`, and it must not be baked into a cached server
 * render where it would report a different device's bundle.
 */
const shellIdentity = ref(classifyShellIdentity({ isNativeApp: false, reported: undefined }))

onMounted(() => {
  shellIdentity.value = classifyShellIdentity({
    isNativeApp: (window as any).isReactNativeWebView === true,
    reported: (window as any).__shellBundleIdentity,
  })
})

type Provider = 'kakao' | 'google' | 'apple'
type KeepAccount = 'current' | 'other'

const PROVIDERS: Provider[] = ['kakao', 'google', 'apple']

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
  isReactNativeWebView?: boolean
  ReactNativeWebView?: {
    postMessage(message: string): void
  }
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
const showMergeConfirmModal = ref(false)
const mergeInfo = ref<MergeInfo | null>(null)
const mergeLoading = ref(false)
const linkingProvider = ref<Provider | null>(null)
let pendingNativeAppleState: string | null = null

const emailButtonText = computed(() => {
  if (resendingEmail.value) return '전송 중...'
  if (emailCooldown.value > 0) return `${emailCooldown.value}초`
  return '인증 메일 발송'
})

const handlePasswordAction = () => {
  if (!linkedAccounts.value?.has_password) {
    navigateTo('/auth/forgot-password')
    return
  }
  showPasswordPanel.value = !showPasswordPanel.value
}

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

const getErrorPayload = (error: unknown): Record<string, unknown> | null => {
  if (!isRecord(error)) return null
  return isRecord(error.data) ? error.data : error
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

const fetchLinkedAccounts = async () => {
  try {
    const response = await api.GET('/api/v1/auth/linked-accounts/')
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
  const response = await api.POST('/api/v1/auth/oauth/link-state/')
  const state = response.state
  if (typeof state !== 'string' || !state) {
    throw new Error('Invalid OAuth state')
  }
  const encodedState = encodeURIComponent(state)
  return decodeURIComponent(encodedState)
}

const getOAuthProviderConfig = (provider: Provider) => {
  const providerConfig = {
    kakao: {
      clientId: config.public.KAKAO_CLIENT_ID,
      redirectUri: resolveSocialRedirectUri(
        'kakao',
        config.public.KAKAO_REDIRECT_URI,
        window.location.origin,
      ),
      baseUrl: 'https://kauth.kakao.com/oauth/authorize',
    },
    google: {
      clientId: config.public.GOOGLE_CLIENT_ID,
      redirectUri: resolveSocialRedirectUri(
        'google',
        config.public.GOOGLE_REDIRECT_URI,
        window.location.origin,
      ),
      baseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'email profile',
    },
    apple: {
      clientId: config.public.APPLE_CLIENT_ID,
      redirectUri: resolveSocialRedirectUri(
        'apple',
        config.public.APPLE_REDIRECT_URI,
        window.location.origin,
      ),
      baseUrl: 'https://appleid.apple.com/auth/authorize',
      scope: 'name email',
    },
  }
  return providerConfig[provider]
}

const handleLinkGoogle = () => handleLinkProvider('google')

const handleLinkProvider = async (provider: Provider) => {
  if (linkingProvider.value) return

  const nativeWindow = window as NativeWindow
  const useNativeAppleLink = shouldUseNativeAppleLink(
    provider,
    nativeWindow.isReactNativeWebView === true,
  )
  if (!useNativeAppleLink) {
    const { clientId, redirectUri } = getOAuthProviderConfig(provider)
    if (!clientId || !redirectUri) {
      await modal.alert({
        title: '연결 설정이 필요합니다',
        description: `${getProviderDisplayName(provider)} 로그인 설정을 확인해주세요.`,
        icon: 'error',
      })
      return
    }
  }

  linkingProvider.value = provider
  try {
    const state = await getOAuthLinkState()
    if (useNativeAppleLink) {
      if (!nativeWindow.ReactNativeWebView) {
        throw new Error('Native Apple authentication bridge is unavailable.')
      }
      pendingNativeAppleState = state
      nativeWindow.ReactNativeWebView.postMessage(JSON.stringify(
        buildNativeAppleLinkRequest(state),
      ))
      return
    }
    const providerConfig = getOAuthProviderConfig(provider)
    const authUrl = buildOAuthLinkUrl(provider, providerConfig, state)
    window.location.assign(authUrl)
  } catch (error: unknown) {
    pendingNativeAppleState = null
    linkingProvider.value = null
    await modal.alert({
      title: '계정 연결 실패',
      description: getErrorMessage(error, '소셜 계정 연결을 시작하지 못했습니다.'),
      icon: 'error',
    })
  }
}

const completeNativeAppleLink = async (result: {
  state: string
  idToken: string
  code: string
}) => {
  try {
    await api.POST('/api/v1/auth/link-social/', {
      provider: 'apple',
      code: result.code,
      state: result.state,
      id_token: result.idToken,
    })
    await fetchLinkedAccounts()
    await modal.alert({
      title: '연결 완료',
      description: 'Apple 계정이 연결되었습니다.',
      icon: 'success'
    })
  } catch (error: unknown) {
    const payload = getErrorPayload(error)
    if (payload && getBoolean(payload, 'can_merge')) {
      const normalized = normalizeMergeInfo({
        ...payload,
        provider: 'apple',
        code: result.code,
        id_token: result.idToken,
      })
      if (normalized) {
        mergeInfo.value = normalized
        showMergeModal.value = true
        showMergeConfirmModal.value = false
        return
      }
    }
    await modal.alert({
      title: '연결 실패',
      description: getErrorMessage(error, 'Apple 계정 연결에 실패했습니다.'),
      icon: 'error'
    })
  } finally {
    linkingProvider.value = null
  }
}

const handleNativeAppleLinkMessage = (event: MessageEvent<unknown>) => {
  let payload = event.data
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return
    }
  }
  const result = parseNativeAppleLinkResult(payload)
  if (!result || result.state !== pendingNativeAppleState) return
  pendingNativeAppleState = null
  if ('error' in result) {
    linkingProvider.value = null
    if (result.error !== 'cancelled') {
      void modal.alert({
        title: '연결 실패',
        description: 'Apple 시스템 로그인을 시작하지 못했습니다.',
        icon: 'error'
      })
    }
    return
  }
  void completeNativeAppleLink(result)
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
    await api.POST('/api/v1/auth/unlink-social/', { provider })
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
    await api.POST('/api/v1/auth/set-password/', {
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
    await api.POST('/api/v1/auth/resend-verification/')
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
    await api.POST('/api/v1/auth/logout-all/')
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
    await api.POST(
      '/api/v1/auth/delete-account/',
      buildDeleteAccountPayload(deletePassword.value),
    )
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
    const response = await api.POST('/api/v1/auth/merge-accounts/', payload)
    
    const data = response
    
    if (keepAccount === 'other' && data.access) {
      auth.setTokens(data.access, data.refresh)
      auth.setUser(data.user as Parameters<typeof auth.setUser>[0])
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

const isProvider = (provider: string): provider is Provider => {
  return provider === 'kakao' || provider === 'google' || provider === 'apple'
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  window.addEventListener('message', handleNativeAppleLinkMessage)
  await auth.initialize()
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
  
  await Promise.all([
    fetchLinkedAccounts(),
    notificationsStore.fetchSettings(),
    readingSettings.initialize(),
  ])
})

onUnmounted(() => {
  window.removeEventListener('message', handleNativeAppleLinkMessage)
  if (emailCooldownTimer) {
    clearInterval(emailCooldownTimer)
  }
})
</script>

<style scoped>
.account-settings-page {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 20px calc(96px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  letter-spacing: var(--tracking-body);
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.profile-hero { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
.profile-avatar, .account-avatar { width: 52px; height: 52px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--color-accent-primary-light); }
.profile-avatar img, .account-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: var(--color-accent-primary); background: var(--color-accent-primary-light); font-size: 20px; font-weight: 700; }
.profile-summary { flex: 1; min-width: 0; }
.profile-summary h2 { margin: 0; font-size: 17px; font-weight: 700; }
.profile-summary p { margin: 4px 0 0; font-size: 13px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-hero :deep(.app-button) { flex-shrink: 0; }
.group-label { margin: 0 0 8px; padding-inline: 4px; font-size: 12px; font-weight: 600; line-height: 1.4; color: var(--color-text-tertiary); }
.group-heading { display: flex; align-items: center; justify-content: space-between; margin-top: -12px; }
.group-heading .group-label { margin-bottom: 0; }
.group-heading .text-action { font-size: 12px; }
.setting-row { display: flex; align-items: center; gap: 12px; }
.setting-info { flex: 1; min-width: 0; }
.setting-label { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.5; color: var(--color-text-primary); }
.setting-description { margin: 2px 0 0; font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
.row-action { width: 100%; border: 0; background: transparent; text-align: left; text-decoration: none; font: inherit; }
.chevron { flex-shrink: 0; color: var(--color-text-tertiary); }
.theme-row { display: flex; flex-direction: column; gap: 12px; }
.linked-list { border-bottom: 1px solid var(--color-border-light); }
.provider-icon, .row-icon { display: grid; place-items: center; flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.provider-icon.kakao { background: var(--color-kakao-bg); color: var(--color-kakao-text); }
.provider-icon.apple { background: var(--color-text-primary); color: var(--color-bg-card); }
.connected-badge { flex-shrink: 0; padding: 4px 8px; border: 1px solid transparent; border-radius: var(--radius-pill); background: var(--color-accent-primary-light); color: var(--color-accent-primary); font-size: 11px; font-weight: 600; }
.connect-action { display: grid; place-items: center; padding: 0; border: 0; background: transparent; }
.connect-action span { display: grid; place-items: center; min-width: 52px; height: 30px; padding: 0 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
.text-action { display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); font-size: 13px; font-weight: 500; text-decoration: none; }
.unlink-action { padding-inline: 0; font-size: 12px; }
.switch-hit { display: grid; place-items: center; flex-shrink: 0; padding: 0; border: 0; border-radius: var(--radius-pill); background: transparent; }
.switch-track { display: block; width: 40px; height: 24px; padding: 3px; border-radius: var(--radius-pill); background: var(--color-border-default); transition: background var(--duration-micro) ease; }
.switch-thumb { display: block; width: 18px; height: 18px; border-radius: 50%; background: var(--color-bg-card); box-shadow: var(--shadow-sm); transition: transform var(--duration-micro) ease; }
.switch-hit[aria-checked="true"] .switch-track { background: var(--color-accent-primary); }
.switch-hit[aria-checked="true"] .switch-thumb { transform: translateX(16px); }
.notification-error { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 8px; }
.section-note { margin: 8px 4px 0; color: var(--color-text-tertiary); font-size: 11px; line-height: 1.5; }
.setting-row.highlight { padding: 12px 20px; border-top: 1px solid var(--color-border-light); }
.setting-row.highlight .row-icon { color: var(--color-accent-primary); background: var(--color-accent-primary-light); }
.account-actions { text-align: center; }
.footer-links { display: flex; justify-content: center; gap: 20px; }
.text-action.danger { color: var(--color-error); }
.all-devices { font-size: 12px; }
.inline-form { display: flex; flex-direction: column; gap: 14px; padding: 20px; border-top: 1px solid var(--color-border-light); text-align: left; }
.danger-form { margin-top: 12px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); }
.input-wrapper { display: flex; flex-direction: column; gap: 6px; }
.input-wrapper label { color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
.input-wrapper input { width: 100%; min-height: 44px; padding: 10px 20px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; font-size: 15px; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.error-text { margin: 0; color: var(--color-error); font-size: 12px; }
.settings-card, .merge-modal-content { border: 1px solid var(--color-border-default); border-radius: var(--radius-card); padding: 20px; background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.section-heading h3, .modal-title { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
.eyebrow { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); }
.wide-action, .select-btn, .btn-cancel-full { width: 100%; padding: 10px 16px; margin-top: 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); font: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-card); }
.wide-action.primary, .select-btn { background: var(--color-accent-primary); color: var(--color-text-inverse); border-color: var(--color-accent-primary); }
.merge-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--color-overlay); backdrop-filter: blur(2px); }
.merge-modal-content { width: min(100%, 540px); max-height: 90dvh; overflow-y: auto; box-shadow: var(--shadow-sheet); }
.merge-description { margin: 0 0 20px; color: var(--color-text-secondary); font-size: 14px; line-height: 1.6; }
.merge-accounts { display: grid; gap: 14px; }
.account-card { padding: 20px; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); }
.account-badge { display: inline-flex; margin-bottom: 12px; padding: 4px 8px; border-radius: var(--radius-pill); background: var(--color-accent-primary-light); color: var(--color-accent-primary); font-size: 11px; font-weight: 600; }
.account-avatar { width: 48px; height: 48px; margin-bottom: 12px; }
.account-nickname, .account-email, .account-providers, .account-date { margin: 0; }
.account-nickname { font-weight: 700; }
.account-email, .account-date { color: var(--color-text-secondary); font-size: 12px; }
.account-providers { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
.provider-tag { padding: 3px 8px; border-radius: var(--radius-pill); background: var(--color-bg-tertiary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
.merge-warning { margin: 16px 0 0; padding: 12px; border-radius: var(--radius-control); color: var(--color-error); background: var(--color-error-bg); font-size: 12px; line-height: 1.5; }
/* Keep the signed-in shell bundle diagnostic available. */
.shell-identity { margin: 4px 0; text-align: center; font-size: 11px; color: var(--color-text-tertiary); }
button, a { min-width: 44px; min-height: 44px; cursor: pointer; transition: background var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button:hover:not(:disabled), a:hover { background-color: var(--color-bg-hover); }
button:active:not(:disabled), a:active { transform: scale(0.97); }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 1px var(--color-accent-primary); }
.profile-hero, .settings-group, .account-actions { animation: settings-enter var(--duration-enter) var(--ease-out-quint) both; }
.notification-group { animation-delay: 50ms; }
.account-group { animation-delay: 100ms; }
.display-group { animation-delay: 150ms; }
.account-actions { animation-delay: 200ms; }
@keyframes settings-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
[data-theme="dark"] .connected-badge { background: transparent; border: 1.5px solid var(--color-accent-primary); }
@media (min-width: 1024px) { .account-settings-page { padding: 36px 40px; } }
@media (max-width: 360px) { .setting-row { gap: 8px; } .setting-row.highlight { flex-wrap: wrap; } }
@media (prefers-reduced-motion: reduce) {
  .profile-hero, .settings-group, .account-actions { animation-name: settings-fade; animation-delay: 0ms; }
  button, a, .switch-track, .switch-thumb { transition: none; }
  button:active:not(:disabled), a:active { transform: none; }
  @keyframes settings-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
