<template>
  <div class="header-wrapper">
    <header class="header">
      <NuxtLink to="/" class="logo-link">
        <NuxtImg
          src="/images/logo-transparent.png"
          alt="매일일독"
          class="logo"
          loading="eager"
          format="webp"
        />
      </NuxtLink>
      <div class="header-controls">
        <div class="auth-buttons">
          <template v-if="!isAuthPage">
            <ClientOnly>
              <!-- 프로필 드롭다운 -->
              <div v-if="user" class="profile-dropdown" ref="profileDropdown">
                <button
                  @click="toggleProfileMenu"
                  class="profile-button"
                  title="프로필 메뉴"
                  aria-label="프로필 메뉴"
                  :aria-expanded="isProfileMenuOpen"
                >
                  <NuxtImg
                    v-if="user.profile_image"
                    :src="user.profile_image"
                    :alt="user.nickname"
                    class="profile-image"
                    loading="lazy"
                  />
                  <div v-else class="profile-placeholder">
                    <UserIcon :size="20" />
                  </div>
                </button>
                
                <!-- 드롭다운 메뉴 -->
                <transition name="dropdown">
                  <div v-if="isProfileMenuOpen" class="dropdown-menu">
                    <div class="dropdown-header">
                      <p class="dropdown-nickname">{{ user.nickname }}</p>
                      <p class="dropdown-email">{{ user.email }}</p>
                    </div>
                    <div class="dropdown-divider"></div>
                    <NuxtLink
                      :to="`/profile/${user.id}`"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <UserIcon :size="16" />
                      내 프로필
                    </NuxtLink>
                    <NuxtLink
                      to="/plans"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <CalendarDaysIcon :size="16" />
                      플랜 관리
                    </NuxtLink>
                    <NuxtLink
                      to="/plan"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <ClipboardListIcon :size="16" />
                      성경통독표
                    </NuxtLink>
                    <NuxtLink
                      to="/groups"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <UsersIcon :size="16" />
                      그룹
                    </NuxtLink>
                    <NuxtLink
                      to="/friends"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <UserRoundPlusIcon :size="16" />
                      친구
                    </NuxtLink>
                    <div class="dropdown-divider"></div>
                    <button 
                      @click="handleLogout" 
                      class="dropdown-item text-red"
                    >
                      <LogOutIcon :size="16" />
                      로그아웃
                    </button>
                  </div>
                </transition>
              </div>
              <NuxtLink
                v-if="user"
                to="/notifications"
                class="notification-link"
                title="알림"
              >
                <NotificationBell :count="notificationsStore.unreadCount" />
              </NuxtLink>
              <NuxtLink
                v-else
                to="/login"
                class="auth-button"
                title="로그인"
              >
                <LogInIcon :size="20" />
                <span class="button-text">로그인</span>
              </NuxtLink>
            </ClientOnly>
          </template>
        </div>
        <!-- Theme Toggle Button -->
        <ClientOnly>
          <button
            class="theme-toggle-button"
            @click="toggleTheme"
            :title="currentTheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'"
            :aria-label="currentTheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'"
          >
            <SunIcon v-if="currentTheme === 'dark'" :size="20" />
            <MoonIcon v-else :size="20" />
          </button>
        </ClientOnly>
        <button class="menu-button" aria-label="메뉴 열기" @click="isMenuOpen = true">
          <MenuIcon :size="20" />
        </button>
      </div>
    </header>
  </div>
  <Menu :is-open="isMenuOpen" @close="isMenuOpen = false" />
</template>

<script setup>
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
  UserRoundPlusIcon,
  UsersIcon
} from '@lucide/vue'
import { useAuthService } from '~/composables/useAuthService'
import { useReadingSettingsStore } from '~/stores/readingSettings'
import { useNotificationsStore } from '~/stores/notifications'
import { useRouter, useRoute } from 'vue-router'
import { computed, ref, inject, onMounted, onUnmounted, watch } from 'vue'
import Menu from '~/components/Menu.vue'
import NotificationBell from '~/components/notifications/NotificationBell.vue'

const auth = useAuthService()
const readingSettingsStore = useReadingSettingsStore()
const notificationsStore = useNotificationsStore()
const router = useRouter()
const route = useRoute()
const isMenuOpen = ref(false)
const isProfileMenuOpen = ref(false)
const profileDropdown = ref(null)
const toast = inject('toast')

// Theme
const currentTheme = computed(() => readingSettingsStore.effectiveTheme)
const toggleTheme = () => {
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark'
  readingSettingsStore.updateSetting('theme', newTheme)
}

// Initialize theme on mount
onMounted(() => {
  readingSettingsStore.initialize()
})

watch(
  () => auth.isAuthenticated.value,
  (isAuthenticated) => {
    if (isAuthenticated) {
      notificationsStore.fetchInbox()
    }
  },
  { immediate: true },
)

const user = computed(() => auth.user.value)
const isAuthenticated = computed(() => auth.isAuthenticated.value)

const isAuthPage = computed(() => {
  return ['/login', '/register'].includes(route.path)
})

const toggleProfileMenu = () => {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
}

const closeProfileMenu = () => {
  isProfileMenuOpen.value = false
}

const handleLogout = async () => {
  closeProfileMenu()
  await auth.logout()
  toast.value?.show('로그아웃 되었어요.')
  router.push('/')
}

// 외부 클릭 감지
const handleClickOutside = (event) => {
  if (profileDropdown.value && !profileDropdown.value.contains(event.target)) {
    closeProfileMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.header-wrapper {
  width: 100%;
}

.header {
  max-width: 768px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  letter-spacing: -0.05em;
  height: 56px;
}

.logo-link {
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.logo {
  height: 20px;
  width: auto;
  margin-left: 5px;
  transition: filter 0.2s ease;
}

/* 다크모드에서 로고 반전 */
[data-theme="dark"] .logo {
  filter: brightness(0) invert(1);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auth-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auth-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.notification-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--color-text-primary);
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.notification-link:hover {
  background: var(--primary-light);
}

.auth-button:hover {
  background: var(--primary-light);
}

.button-text {
  font-size: 0.9rem;
  font-weight: 500;
}

@media (max-width: 640px) {
  .auth-button {
    padding: 0.5rem 0.75rem; /* 패딩 약간 줄임 */
  }

  .button-text {
    font-size: 0.8125rem; /* 글자 크기 약간 줄임 */
  }
}

.menu-button {
  background: none;
  border: none;
  padding: 0.375rem;
  margin: -0.5rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-button:hover {
  opacity: 0.7;
}

.menu-button:active {
  transform: scale(0.95);
}

.menu-button svg {
  width: 24px;
  height: 24px;
}

/* Theme Toggle Button */
.theme-toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--color-slate-100);
  color: var(--color-slate-700);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle-button:hover {
  background: var(--color-slate-200);
  transform: scale(1.05);
}

.theme-toggle-button:active {
  transform: scale(0.95);
}

.profile-dropdown {
  position: relative;
}

.profile-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  background: none;
  cursor: pointer;
}

.profile-button:hover {
  border-color: var(--primary-color);
  transform: scale(1.05);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: var(--color-bg-card);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-slate-200);
  z-index: 100;
  overflow: hidden;
}

.dropdown-header {
  padding: 12px 16px;
  background: var(--color-slate-50);
}

.dropdown-nickname {
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.dropdown-email {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-slate-200);
  margin: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: var(--text-primary);
  text-decoration: none;
  transition: all 0.15s ease;
  font-size: 0.875rem;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--color-slate-100);
}

.dropdown-item.text-red {
  color: #DC2626;
}

.dropdown-item.text-red:hover {
  background: var(--color-slate-100);
}

/* 드롭다운 애니메이션 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.profile-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  color: var(--primary-color);
}

@media (max-width: 640px) {
  .profile-button {
    width: 32px;
    height: 32px;
  }
}
</style>
