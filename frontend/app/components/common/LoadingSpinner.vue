<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  readonly size?: 'sm' | 'md' | 'lg' | number
  readonly color?: 'primary' | 'white' | 'gray'
  readonly text?: string
  readonly fullScreen?: boolean
  readonly placement?: 'inline' | 'section' | 'page' | 'overlay'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md', color: 'primary', fullScreen: false
})
const sizes = { sm: 16, md: 32, lg: 48 } as const
const borders = { sm: 2, md: 3, lg: 4 } as const
const borderWidth = computed(() => typeof props.size === 'number' ? 3 : borders[props.size])
const diameter = computed(() => typeof props.size === 'number' ? props.size : sizes[props.size])
const resolvedPlacement = computed(() => props.placement ?? (props.fullScreen ? 'overlay' : 'inline'))
</script>

<template>
  <div class="loading-spinner-container" :class="`placement-${resolvedPlacement}`" role="status" aria-live="polite">
    <div class="loading-spinner" :class="`color-${color}`" :style="{ width: `${diameter}px`, height: `${diameter}px`, borderWidth: `${borderWidth}px` }" aria-hidden="true" />
    <span v-if="text" class="loading-text">{{ text }}</span>
    <span v-else class="sr-only">로딩 중...</span>
  </div>
</template>

<style scoped>
.loading-spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-secondary);
}
.placement-section { min-height: 200px; }
.placement-page { min-height: calc(100vh - 120px); min-height: calc(100dvh - 120px); }
.placement-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--color-bg-primary) 80%, transparent);
}
.loading-spinner {
  box-sizing: border-box;
  flex-shrink: 0;
  border: 3px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--radius-pill);
  animation: loading-spin calc(var(--duration-standard) * 4) linear infinite;
}
.color-primary { color: var(--color-accent-primary); }
.color-white { color: white; }
.color-gray { color: var(--color-text-tertiary); }
.loading-text { font-size: 14px; text-align: center; letter-spacing: var(--tracking-body); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@keyframes loading-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .loading-spinner { animation: none; } }
</style>
