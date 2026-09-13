<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { NuxtLink } from '#components'
defineProps<{ back?: string }>()
</script>

<template>
  <main class="auth-shell">
    <div class="auth-column">
      <header class="auth-header">
        <NuxtLink v-if="back" :to="back" class="auth-back press" aria-label="뒤로가기"><ChevronLeft :size="22" aria-hidden="true" /></NuxtLink>
        <NuxtImg src="/images/logo-transparent.png" alt="매일일독" class="auth-logo" loading="eager" format="webp" />
      </header>
      <slot />
    </div>
  </main>
</template>

<style scoped>
.auth-shell { min-height: 100dvh; background: var(--color-bg-primary); color: var(--color-text-primary); font-family: var(--font-sans); letter-spacing: var(--tracking-body); padding: max(12px, env(safe-area-inset-top, 0px)) var(--screen-gutter) max(24px, env(safe-area-inset-bottom, 0px)); }
.auth-column { max-width: 440px; min-height: calc(100dvh - 64px); margin-inline: auto; display: flex; flex-direction: column; gap: 24px; }
.auth-header { display: flex; align-items: center; gap: 12px; min-height: 52px; }
.auth-logo { height: 22px; width: auto; object-fit: contain; }
:global([data-theme="dark"] .auth-shell .auth-logo) { filter: brightness(0) invert(1); }
.auth-back { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--color-text-primary); }
.auth-back:hover { background: var(--color-bg-hover); }
.auth-shell :deep(h1) { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.auth-shell :deep(p) { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.auth-shell :deep(.auth-description) { font-size: 13px; color: var(--color-text-secondary); }
.auth-shell :deep(.auth-form) { display: flex; flex-direction: column; flex: 1; gap: 16px; }
.auth-shell :deep(.auth-field) { display: flex; flex-direction: column; gap: 6px; }
.auth-shell :deep(label) { font-size: 13px; font-weight: 600; }
.auth-shell :deep(.auth-input) { box-sizing: border-box; width: 100%; height: 48px; padding: 0 16px; border: 1px solid var(--color-border-default); border-radius: 14px; background: var(--color-bg-card); color: var(--color-text-primary); font: inherit; font-size: 14px; }
.auth-shell :deep(.auth-input::placeholder) { color: var(--color-text-tertiary); }
.auth-shell :deep(.auth-input:focus-visible) { outline: none; border-color: var(--color-accent-primary); box-shadow: 0 0 0 3px var(--color-accent-focus-ring); }
.auth-shell :deep(.auth-input[aria-invalid="true"]) { border-color: var(--color-error); }
.auth-shell :deep(.input-success) { border-color: var(--color-accent-primary); }
.auth-shell :deep(.auth-error) { color: var(--color-error); font-size: 12px; }
.auth-shell :deep(.auth-success) { color: var(--color-accent-primary); font-size: 12px; }
.auth-shell :deep(.auth-status) { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; padding-block: 40px; }
.auth-shell :deep(.auth-status h1) { font-size: 22px; }
.auth-shell :deep(.auth-status-icon) { width: 64px; height: 64px; box-sizing: border-box; padding: 16px; border-radius: 50%; color: var(--color-accent-primary); background: var(--color-accent-bg); }
.auth-shell :deep(.auth-status-icon.is-error) { color: var(--color-error); background: var(--color-error-bg); }
.auth-shell :deep(.auth-link) { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-accent-primary); border-radius: var(--radius-pill); font-size: 13px; text-decoration: none; }
.auth-shell :deep(.auth-link:hover) { background: var(--color-bg-hover); }
.auth-shell :deep(.auth-actions) { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.auth-shell :deep(.auth-code) { font-family: monospace; font-size: 11px; overflow-wrap: anywhere; padding: 12px; border-radius: 10px; background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.auth-shell :deep(.spinner) { animation: auth-spin 1s linear infinite; }
.auth-shell :deep(button:disabled) { opacity: .45; }
@keyframes auth-spin { to { transform: rotate(360deg); } }
@media (min-width: 768px) { .auth-shell { padding-top: 40px; } .auth-column { min-height: calc(100dvh - 100px); } }
@media (prefers-reduced-motion: reduce) { .auth-shell :deep(.spinner) { animation: none; } }
</style>
