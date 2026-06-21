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
                      <SunIcon v-if="currentTheme === 'dark'" :size="20" />
                      <MoonIcon v-else :size="20" />
                    </button>
                    <button class="close-button" @click="$emit('close')" aria-label="메뉴 닫기">
                      <XIcon :size="24" />
                    </button>
                  </div>
                </div>

                <nav class="menu-items">
                  <!-- 공지사항 메뉴 아이템 추가 (가장 위에 배치) -->
                  <NuxtLink to="/notice" class="menu-item" @click="$emit('close')">
                    <MessageCircleIcon :size="24" />
                    <span>공지사항</span>
                  </NuxtLink>

                  <NuxtLink
                    v-if="user"
                    to="/notifications"
                    class="menu-item"
                    @click="$emit('close')"
                  >
                    <BellIcon :size="24" />
                    <span>내 알림</span>
                  </NuxtLink>

                  <NuxtLink to="/bible" class="menu-item" @click="$emit('close')">
                    <BookOpenIcon :size="24" />
                    <span>오늘일독</span>
                  </NuxtLink>

                  <NuxtLink to="/plan" class="menu-item" @click="$emit('close')">
                    <ClipboardListIcon :size="24" />
                    <span>성경통독표</span>
                  </NuxtLink>

                  <NuxtLink to="/plans" class="menu-item" @click="$emit('close')">
                    <CalendarDaysIcon :size="24" />
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
                    <UserIcon :size="24" />
                    <span>내 프로필</span>
                  </NuxtLink>

                  <NuxtLink to="/scoreboard" class="menu-item" @click="$emit('close')">
                    <ListIcon :size="24" />
                    <span>리더보드</span>
                  </NuxtLink>

                  <NuxtLink to="/groups" class="menu-item" @click="$emit('close')">
                    <UsersIcon :size="24" />
                    <span>그룹</span>
                  </NuxtLink>

                  <NuxtLink to="/friends" class="menu-item" @click="$emit('close')">
                    <UserRoundPlusIcon :size="24" />
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
                    <SettingsIcon :size="24" />
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
import {
  BookOpenIcon,
  BellIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  ListIcon,
  MessageCircleIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
  UserRoundPlusIcon,
  UsersIcon,
  XIcon,
} from '@lucide/vue'

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
