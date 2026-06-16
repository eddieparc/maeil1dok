<template>
  <div class="floating-bottom-area">
    <div v-if="$slots.popover" class="floating-above-popover">
      <slot name="popover" />
    </div>

    <slot name="above" />

    <nav class="floating-bottom-navigation">
      <NuxtLink to="/" class="floating-side-nav-item" aria-label="홈으로 이동">
        <HomeIcon :size="18" aria-hidden="true" />
      </NuxtLink>

      <div class="floating-center-nav-group">
        <slot name="center" />
      </div>

      <NuxtLink :to="profileLink" class="floating-side-nav-item" aria-label="내 프로필">
        <UserIcon :size="18" aria-hidden="true" />
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { HomeIcon, UserIcon } from '@lucide/vue';
import { useAuthService } from '~/composables/useAuthService';

const auth = useAuthService();

const profileLink = computed(() => (
  auth.user.value ? `/profile/${auth.user.value.id}` : '/login'
));
</script>

<style scoped>
.floating-bottom-area {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: min(400px, calc(100vw - 32px));
  z-index: 100;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.floating-above-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.75rem);
  width: 100%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.floating-above-popover :deep(*) {
  pointer-events: auto;
}

.floating-bottom-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 46px;
  gap: 0.5rem;
  padding: 0.5rem;
  pointer-events: auto;
}

.floating-center-nav-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.floating-side-nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-slate-500, #64748b);
  border-radius: 8px;
  text-decoration: none;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.floating-side-nav-item:hover {
  color: var(--color-accent-primary);
  background: rgba(75, 159, 126, 0.08);
}

.floating-side-nav-item:active {
  transform: scale(0.92);
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .floating-bottom-area {
    bottom: calc(16px + env(safe-area-inset-bottom));
  }
}

[data-theme="dark"] .floating-bottom-area {
  background: rgba(31, 41, 55, 0.82);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .floating-side-nav-item {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .floating-side-nav-item:hover {
  color: var(--color-accent-primary);
  background: rgba(107, 201, 159, 0.1);
}
</style>
