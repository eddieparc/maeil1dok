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
            <AppSwitch
              :label="item.label"
              :description="item.description"
              :model-value="Boolean(notificationSettings?.notifications_enabled && notificationSettings[item.key])"
              :disabled="!notificationSettings || notificationsBusy"
              @update:model-value="toggleNotification(item.key)"
            />
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

      <section class="settings-group data-group" aria-labelledby="data-heading">
        <h3 id="data-heading" class="group-label">데이터</h3>
        <ListCard :padded="false">
          <button type="button" class="list-card-row setting-row row-action" @click="isDataManagementOpen = true">
            <div class="setting-info">
              <p class="setting-label">데이터 관리</p>
              <p class="setting-description">북마크 · 노트 · 하이라이트 · 초기화</p>
            </div>
            <ChevronRight :size="18" class="chevron" aria-hidden="true" />
          </button>
        </ListCard>
      </section>

      <section class="settings-group app-group" aria-labelledby="app-heading">
        <h3 id="app-heading" class="group-label">앱</h3>
        <ListCard :padded="false">
          <div class="list-card-row setting-row">
            <AppSwitch
              label="베타 모드"
              description="테스트 버전(beta.maeil1dok.app)을 사용합니다"
              :model-value="betaModeEnabled"
              @update:model-value="handleBetaToggle"
            />
          </div>
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
        <button class="wide-action primary" @click="openMergePicker">
          병합 계정 선택하기
        </button>
      </section>

      <ReadingSettingsSheet v-model="isReadingSettingsOpen" />
      <DataManagementSheet v-model="isDataManagementOpen" />
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
import { classifyShellIdentity } from '~/composables/shellBundleIdentity'
import { useAccountLinking } from '~/composables/account-settings/useAccountLinking'
import { normalizeMergeInfo, getErrorMessage } from '~/composables/account-settings/normalize'
import { PROVIDERS, type NativeWindow } from '~/composables/account-settings/types'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'
import AppSwitch from '~/components/ui/AppSwitch.vue'
import ListCard from '~/components/ui/ListCard.vue'
import SegmentedControl from '~/components/ui/SegmentedControl.vue'
import ProfileEditModal from '~/components/profile/ProfileEditModal.vue'
import ReadingSettingsSheet from '~/components/ReadingSettingsSheet.vue'
import DataManagementSheet from '~/components/DataManagementSheet.vue'
import { Apple, CheckCircle, ChevronRight, Globe, Mail, MessageCircle } from '@lucide/vue'
import { useNotificationsStore, type NotificationSettings } from '~/stores/notifications'
import { useReadingSettingsStore } from '~/stores/readingSettings'
import { useProfileStore } from '~/stores/profile'
import {
  betaModeTargetUrl,
  buildDeleteAccountPayload,
  canShellSwitchBeta,
  getProviderDisplayName,
  isBetaHost,
} from '~/utils/accountSettingsRuntime.js'
import { isNativeApp, sendToNative } from '~/types/native-bridge'

useHead({
  title: '계정 설정 - 매일일독',
})

const auth = useAuthService()
const modal = useModal()
const api = useApi()
const { goBack } = useNavigation()
const notificationsStore = useNotificationsStore()
const readingSettings = useReadingSettingsStore()
const isReadingSettingsOpen = ref(false)
const isDataManagementOpen = ref(false)
const profileStore = useProfileStore()

const {
  loading,
  linkedAccounts,
  linkingProvider,
  mergeInfo,
  showMergeModal,
  isProviderLinked,
  canUnlink,
  fetchLinkedAccounts,
  handleLinkProvider,
  handleUnlink,
  openMergePicker,
  beginMerge,
} = useAccountLinking()

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

/**
 * Whether this page is being served from the beta host. Read on mount rather
 * than during SSR: the answer lives on `window.location`, and it must not be
 * baked into a cached server render.
 */
const betaModeEnabled = ref(false)

onMounted(() => {
  shellIdentity.value = classifyShellIdentity({
    isNativeApp: (window as any).isReactNativeWebView === true,
    reported: (window as any).__shellBundleIdentity,
  })
  betaModeEnabled.value = isBetaHost(window.location.hostname)
})

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

const handleBetaToggle = async (enabled: boolean) => {
  if (isNativeApp() && !canShellSwitchBeta(window)) {
    await modal.alert({
      title: '앱 업데이트가 필요합니다',
      description: '베타 모드는 최신 버전의 앱에서만 사용할 수 있습니다. 앱을 업데이트해주세요.',
      icon: 'error'
    })
    return
  }

  sendToNative({ type: 'beta:set', enabled })

  // The new shell owns navigation after beta:set; only navigate here when
  // there is no shell to do it (plain browser).
  if (!(isNativeApp() && canShellSwitchBeta(window))) {
    window.location.assign(betaModeTargetUrl(enabled))
  }
}

onMounted(async () => {
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
      beginMerge(normalizeMergeInfo(JSON.parse(storedMergeInfo)))
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
.profile-avatar { width: 52px; height: 52px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: var(--color-accent-primary-light); }
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
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
.setting-row :deep(.app-switch) { flex: 1; min-height: 0; }
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
.settings-card { border: 1px solid var(--color-border-default); border-radius: var(--radius-card); padding: 20px; background: var(--color-bg-card); box-shadow: var(--shadow-card); }
.section-heading h3 { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
.eyebrow { margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--color-text-tertiary); }
.wide-action { width: 100%; padding: 10px 16px; margin-top: 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); font: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-card); }
.wide-action.primary { background: var(--color-accent-primary); color: var(--color-text-inverse); border-color: var(--color-accent-primary); }
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
  button, a { transition: none; }
  button:active:not(:disabled), a:active { transform: none; }
  @keyframes settings-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
