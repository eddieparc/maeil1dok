<template>
  <nav class="floating-nav">
    <NuxtLink to="/" class="nav-item" :class="{ active: route.path === '/' || route.path === '/temp-home' }">
      <HomeIcon :size="20" />
      <span class="nav-label">홈</span>
    </NuxtLink>

    <NuxtLink to="/bible" class="nav-item" :class="{ active: route.path.startsWith('/bible') }">
      <BookIcon size="20" />
      <span class="nav-label">성경</span>
    </NuxtLink>
    
    <NuxtLink :to="profileLink" class="nav-item" :class="{ active: route.path.startsWith('/profile') }">
      <UserIcon :size="20" />
      <span class="nav-label">프로필</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthService } from '~/composables/useAuthService';
import BookIcon from '~/components/icons/BookIcon.vue';
import { HomeIcon, UserIcon } from '@lucide/vue';

const route = useRoute();
const auth = useAuthService();

const profileLink = computed(() => {
  return auth.user.value ? `/profile/${auth.user.value.id}` : '/login';
});
</script>

<style scoped>
.floating-nav {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: calc(100% - 32px);
  max-width: min(320px, calc(100vw - 32px));

  background: #2C3333;
  border: 1px solid rgba(44, 51, 51, 0.12);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

  /* 레이아웃 */
  padding: 0.375rem 0.375rem;
  display: flex;
  justify-content: space-between;
  gap: 0.125rem;
}

.nav-item {
  padding: 0.5rem 0.5rem;
  color: rgba(255, 255, 255, 0.72);
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
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.nav-item.active {
  background: #fff;
  color: #2C3333;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  background: #242424;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 -4px 24px rgba(0, 0, 0, 0.4),
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

[data-theme="dark"] .nav-item {
  color: rgba(255, 255, 255, 0.72);
}

[data-theme="dark"] .nav-item:hover:not(.active) {
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

[data-theme="dark"] .nav-item.active {
  background: #fff;
  color: #242424;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
