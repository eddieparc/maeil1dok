<template>
  <!-- 최상위 요소를 Teleport로 감싸서 body에 직접 렌더링하도록 변경 -->
  <Teleport to="body">
    <div>
      <!-- 메뉴 오버레이 -->
      <Transition name="fade">
        <div v-if="isOpen" class="menu-overlay" @click="$emit('close')">
          <div class="menu-container" @click.stop>
            <!-- 메뉴 패널 -->
            <Transition name="slide">
              <div v-if="isOpen" class="menu-panel">
                <div class="menu-header">
                  <h2>메뉴</h2>
                  <div class="header-actions">
                    <!-- 다크모드 토글 버튼 -->
                    <button 
                      class="theme-toggle-button" 
                      @click="toggleTheme"
                      :title="currentTheme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'"
                      aria-label="테마 전환"
                    >
                      <!-- Sun icon (다크모드일 때 표시) -->
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
                      <!-- Moon icon (라이트모드일 때 표시) -->
                      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                      </svg>
                    </button>
                    <button class="close-button" @click="$emit('close')" aria-label="메뉴 닫기">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                <nav class="menu-items">
                  <!-- 공지사항 메뉴 아이템 추가 (가장 위에 배치) -->
                  <NuxtLink to="/notice" class="menu-item" @click="$emit('close')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path
                        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z">
                      </path>
                    </svg>
                    <span>공지사항</span>
                  </NuxtLink>

                  <NuxtLink to="/bible" class="menu-item" @click="$emit('close')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span>오늘일독</span>
                  </NuxtLink>

                  <NuxtLink to="/plan" class="menu-item" @click="$emit('close')">
                    <svg class="check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M9 12H15M9 16H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                        stroke-linejoin="round" />
                    </svg>
                    <span>성경통독표</span>
                  </NuxtLink>

                  <NuxtLink to="/plans" class="menu-item" @click="$emit('close')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>플랜 관리</span>
                  </NuxtLink>

                  <!-- 구분선 -->
                  <div class="menu-divider"></div>

                  <!-- 소셜 기능 메뉴들 -->
                  <NuxtLink 
                    v-if="user"
                    :to="`/profile/${user.id}`" 
                    class="menu-item" 
                    @click="$emit('close')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>내 프로필</span>
                  </NuxtLink>

                  <NuxtLink to="/scoreboard" class="menu-item" @click="$emit('close')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3" y2="6"></line>
                      <line x1="3" y1="12" x2="3" y2="12"></line>
                      <line x1="3" y1="18" x2="3" y2="18"></line>
                    </svg>
                    <span>리더보드</span>
                  </NuxtLink>

                  <NuxtLink to="/groups" class="menu-item" @click="$emit('close')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>그룹</span>
                  </NuxtLink>

                  <NuxtLink to="/friends" class="menu-item" @click="$emit('close')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    <span>친구</span>
                  </NuxtLink>

                  <!-- 구분선 -->
                  <div class="menu-divider"></div>

                  <!-- 계정 설정 -->
                  <NuxtLink 
                    v-if="user"
                    to="/account/settings" 
                    class="menu-item" 
                    @click="$emit('close')"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    <span>계정 설정</span>
                  </NuxtLink>
                </nav>

                <!-- 하단 법적 링크 -->
                <div class="menu-footer">
                  <div class="legal-links">
                    <NuxtLink to="/terms" @click="$emit('close')">이용약관</NuxtLink>
                    <span class="divider">|</span>
                    <NuxtLink to="/privacy" @click="$emit('close')">개인정보처리방침</NuxtLink>
                    <span class="divider">|</span>
                    <NuxtLink to="/company" @click="$emit('close')">회사정보</NuxtLink>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup>
import { useAuthService } from '~/composables/useAuthService'
import { useReadingSettingsStore } from '~/stores/readingSettings'
import { computed } from 'vue'

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close'])
const auth = useAuthService()
const readingSettingsStore = useReadingSettingsStore()
const user = computed(() => auth.user.value)

// Theme
const currentTheme = computed(() => readingSettingsStore.effectiveTheme)
const toggleTheme = () => {
  const newTheme = currentTheme.value === 'dark' ? 'light' : 'dark'
  readingSettingsStore.updateSetting('theme', newTheme)
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  justify-content: flex-end;
  width: 100vw;
  height: 100vh;
}

.menu-container {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: 100%;
  z-index: 1000;
}

.menu-panel {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--color-bg-card);
  padding: 1rem;
  box-shadow: -4px 0 25px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding: 0 0.5rem;
}

.menu-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  background: var(--color-slate-100, #f1f5f9);
  color: var(--color-slate-700, #334155);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-toggle-button:hover {
  background: var(--color-slate-200, #e2e8f0);
  transform: scale(1.05);
}

.theme-toggle-button:active {
  transform: scale(0.95);
}

.close-button {
  padding: 0.5rem;
  margin: -0.5rem;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
}

.close-button:hover {
  background: var(--primary-light);
  color: var(--primary-color);
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  overflow-y: auto;
  padding: 0 0.5rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  color: var(--text-primary);
  text-decoration: none;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.95rem;
}

.menu-item:hover {
  background: var(--primary-light);
  color: var(--primary-color);
  transform: translateX(4px);
}

.menu-item:active {
  transform: translateX(2px);
}

.menu-item svg {
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.menu-item:hover svg {
  color: var(--primary-color);
  transform: scale(1.1);
}

.menu-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
  margin: 0.75rem 0;
}

.menu-footer {
  padding: 1rem 0.5rem;
  padding-bottom: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin-top: auto;
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .menu-footer {
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
}

.legal-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #9ca3af);
}

.legal-links a {
  color: var(--text-tertiary, #9ca3af);
  text-decoration: none;
  transition: color 0.2s ease;
}

.legal-links a:hover {
  color: var(--text-secondary, #6b7280);
}

.legal-links .divider {
  color: var(--text-tertiary, #d1d5db);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

@media (max-width: 640px) {
  .menu-container {
    max-width: 85%;
  }

  .menu-panel {
    padding: 1.25rem 0.75rem;
  }

  .menu-item {
    padding: 0.75rem 0.875rem;
  }

  .menu-item:active {
    background: var(--primary-light);
    transform: translateX(2px);
  }
}

/* Tablet: iPad Mini and similar */
@media (min-width: 768px) {
  .menu-content {
    width: 400px;
  }

  .menu-item {
    padding: 1rem 1.5rem;
    font-size: 1.0625rem;
  }

  .menu-item svg {
    width: 22px;
    height: 22px;
  }
}

/* Tablet Large: iPad Pro and larger tablets */
@media (min-width: 1024px) {
  .menu-content {
    width: 450px;
  }

  .menu-item {
    padding: 1.25rem 2rem;
    font-size: 1.125rem;
  }

  .menu-item svg {
    width: 24px;
    height: 24px;
  }
}

/* ====== 다크모드 스타일 ====== */
[data-theme="dark"] .menu-panel {
  background: var(--color-bg-primary, #1a1a1a);
  box-shadow: -4px 0 25px rgba(0, 0, 0, 0.4);
}

[data-theme="dark"] .menu-header h2 {
  color: var(--text-primary, #f3f4f6);
}

[data-theme="dark"] .close-button {
  color: var(--text-secondary, #9ca3af);
  background: transparent;
}

[data-theme="dark"] .close-button svg {
  color: var(--text-primary, #f3f4f6);
}

[data-theme="dark"] .close-button:hover {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.1));
  color: white;
}

[data-theme="dark"] .menu-item {
  color: var(--text-primary, #f3f4f6);
}

[data-theme="dark"] .menu-item svg {
  stroke: var(--text-secondary, #9ca3af);
}

[data-theme="dark"] .menu-item:hover {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.1));
  color: var(--primary-color, #818cf8);
}

[data-theme="dark"] .menu-item:hover svg {
  stroke: var(--primary-color, #818cf8);
}

[data-theme="dark"] .menu-divider {
  background: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .theme-toggle-button {
  background: var(--color-slate-700, #334155);
  color: var(--color-slate-200, #e2e8f0);
}

[data-theme="dark"] .theme-toggle-button:hover {
  background: var(--color-slate-600, #475569);
}

[data-theme="dark"] .menu-footer {
  border-top-color: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .legal-links {
  color: var(--text-tertiary, #6b7280);
}

[data-theme="dark"] .legal-links a {
  color: var(--text-tertiary, #6b7280);
}

[data-theme="dark"] .legal-links a:hover {
  color: var(--text-secondary, #9ca3af);
}

[data-theme="dark"] .legal-links .divider {
  color: var(--text-tertiary, #4b5563);
}

</style>
