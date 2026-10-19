<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { NuxtLink } from '#components'
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  to?: RouteLocationRaw
}>(), { variant: 'primary', size: 'md', type: 'button' })

const emit = defineEmits<{ click: [event: MouseEvent] }>()
const unavailable = computed(() => props.disabled || props.loading)
function guardClick(event: MouseEvent) {
  if (unavailable.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}
</script>

<template>
  <component
    :is="to !== undefined ? NuxtLink : 'button'"
    :to="to"
    :type="to === undefined ? type : undefined"
    :disabled="to === undefined ? unavailable : undefined"
    :aria-disabled="unavailable || undefined"
    :aria-busy="loading || undefined"
    :tabindex="to !== undefined && unavailable ? -1 : undefined"
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`, { 'app-button--block': block }]"
    @click.capture="guardClick"
    @click="emit('click', $event)"
  >
    <LoaderCircle v-if="loading" class="app-button__spinner" :size="18" aria-hidden="true" />
    <slot />
  </component>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: var(--tracking-body);
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.app-button--sm { height: 40px; padding-inline: 16px; font-size: 13px; }
.app-button--md { height: 48px; }
.app-button--lg { height: 52px; font-size: 15px; }
.app-button--block { display: flex; width: 100%; }
.app-button--primary {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-cta);
}
.app-button--primary:hover:not([aria-disabled="true"]) { background: var(--color-accent-primary-hover); }
.app-button--secondary {
  background: var(--color-accent-bg);
  border-color: var(--color-border-default);
  color: var(--color-accent-primary);
}
.app-button--ghost { background: transparent; color: var(--color-accent-primary); }
.app-button--danger { background: transparent; color: var(--color-error); border-color: var(--color-error); }
.app-button--secondary:hover:not([aria-disabled="true"]),
.app-button--ghost:hover:not([aria-disabled="true"]) { background: var(--color-bg-hover); }
.app-button--danger:hover:not([aria-disabled="true"]) { background: var(--color-error-bg); }
[data-theme="dark"] .app-button--secondary { background: transparent; border: 1.5px solid var(--color-accent-primary); }
[data-theme="dark"] .app-button--secondary:hover:not([aria-disabled="true"]) { background: var(--color-bg-hover); }
.app-button:active:not([aria-disabled="true"]) { transform: scale(0.97); }
.app-button:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  border-color: var(--color-accent-primary);
}
.app-button[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; }
.app-button__spinner { flex-shrink: 0; animation: button-spin 1s linear infinite; }
@keyframes button-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .app-button { transition: none; }
  .app-button:active:not([aria-disabled="true"]) { transform: none; }
  .app-button__spinner { animation: none; }
}
</style>
