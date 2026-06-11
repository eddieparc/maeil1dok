<template>
  <nav class="floating-nav">
    <NuxtLink to="/" class="nav-item" :class="{ active: route.path === '/' || route.path === '/temp-home' }">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="nav-label">홈</span>
    </NuxtLink>

    <NuxtLink to="/plans" class="nav-item" :class="{ active: route.path.startsWith('/plans') }">
      <CalendarIcon size="20" />
      <span class="nav-label">관리</span>
    </NuxtLink>
    
    <NuxtLink to="/bible" class="nav-item" :class="{ active: route.path.startsWith('/bible') }">
      <BookIcon size="20" />
      <span class="nav-label">성경</span>
    </NuxtLink>
    
    <NuxtLink :to="profileLink" class="nav-item" :class="{ active: route.path.startsWith('/profile') }">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="7" r="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="nav-label">프로필</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthService } from '~/composables/useAuthService';
import BookIcon from '~/components/icons/BookIcon.vue';
import CalendarIcon from '~/components/icons/CalendarIcon.vue';

const route = useRoute();
const auth = useAuthService();

const profileLink = computed(() => {
  return auth.user.value ? `/profile/${auth.user.value.id}` : '/login';
});
</script>

<style scoped>
/* 글래스모피즘 플로팅 네비게이션 - bible-bottom-area 스타일과 통일 */
.floating-nav {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: calc(100% - 32px);
  max-width: min(320px, calc(100vw - 32px));

  /* 글래스모피즘 */
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);

  /* 레이아웃 */
  padding: 0.375rem 0.375rem;
  display: flex;
  justify-content: space-between;
  gap: 0.125rem;
}

.nav-item {
  padding: 0.5rem 0.5rem;
  color: var(--color-slate-600, #475569);
  text-decoration: none;
  font-size: clamp(0.6875rem, 3vw, 0.8125rem);
  font-weight: 500;
  border-radius: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: transparent;
  flex: 1;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
}

.nav-item:hover:not(.active) {
  color: var(--color-accent-primary);
  background: var(--color-accent-primary-light);
}

.nav-item.active {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  font-weight: 600;
  box-shadow: var(--shadow-md);
}

.nav-label {
  display: inline-block;
}

/* iOS 안전영역 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .floating-nav {
    bottom: calc(8px + env(safe-area-inset-bottom));
  }
}

/* iOS Safari 전용 - safe-area만 사용 (추가 마진 최소화) */
@supports (-webkit-touch-callout: none) {
  .floating-nav {
    bottom: max(8px, env(safe-area-inset-bottom));
  }
}

@media (max-width: 400px) {
  .nav-item {
    padding: 0.625rem 0.25rem;
    gap: 0.375rem;
    font-size: 0.8125rem;
  }
}

/* ====== 다크모드 스타일 ====== */
[data-theme="dark"] .floating-nav {
  background: rgba(36, 36, 36, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 -4px 24px rgba(0, 0, 0, 0.4),
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

[data-theme="dark"] .nav-item {
  color: var(--color-text-secondary, #9ca3af);
}

[data-theme="dark"] .nav-item:hover:not(.active) {
  color: var(--color-accent-primary, #6bc99f);
  background: var(--color-accent-primary-light);
}

[data-theme="dark"] .nav-item.active {
  background: var(--color-accent-primary, #6bc99f);
  color: var(--color-text-inverse, #1f2937);
  box-shadow: var(--shadow-md);
}
</style>
