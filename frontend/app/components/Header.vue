<template>
  <div class="header-wrapper">
    <header class="header">
      <NuxtLink to="/" class="logo-link">
        <NuxtImg
          src="/images/logo-transparent.png"
          alt="매일일독"
          class="logo"
          loading="lazy"
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      내 프로필
                    </NuxtLink>
                    <NuxtLink
                      to="/plans"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      플랜 관리
                    </NuxtLink>
                    <NuxtLink
                      to="/plan"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 12H15M9 16H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      성경통독표
                    </NuxtLink>
                    <NuxtLink
                      to="/groups"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      그룹
                    </NuxtLink>
                    <NuxtLink
                      to="/friends"
                      class="dropdown-item"
                      @click="closeProfileMenu"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <line x1="20" y1="8" x2="20" y2="14"></line>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
                      </svg>
                      친구
                    </NuxtLink>
                    <div class="dropdown-divider"></div>
                    <button 
                      @click="handleLogout" 
                      class="dropdown-item text-red"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      로그아웃
                    </button>
                  </div>
                </transition>
              </div>
              <NuxtLink
                v-else
                to="/login"
                class="auth-button"
                title="로그인"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M15 12H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
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
            <!-- Sun icon (shown in dark mode) -->
            <svg v-if="currentTheme === 'dark'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <!-- Moon icon (shown in light mode) -->
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </ClientOnly>
        <button class="menu-button" aria-label="메뉴 열기" @click="isMenuOpen = true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>
  </div>
  <Menu :is-open="isMenuOpen" @close="isMenuOpen = false" />
</template>

<script setup>
import { useAuthService } from '~/composables/useAuthService'
import { useReadingSettingsStore } from '~/stores/readingSettings'
import { useRouter, useRoute } from 'vue-router'
import { computed, ref, inject, onMounted, onUnmounted } from 'vue'
import Menu from '~/components/Menu.vue'

const auth = useAuthService()
const readingSettingsStore = useReadingSettingsStore()
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