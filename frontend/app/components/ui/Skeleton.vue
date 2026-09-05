<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  width?: string | number
  height?: string | number
  radius?: string | number
  circle?: boolean
}>(), { width: '100%', radius: 'var(--radius-control)' })
const dimension = (value: string | number) => typeof value === 'number' ? `${value}px` : value
const skeletonStyle = computed(() => ({
  width: dimension(props.width),
  height: props.height !== undefined ? dimension(props.height) : props.circle ? undefined : '16px',
  borderRadius: props.circle ? '50%' : dimension(props.radius),
}))
</script>

<template>
  <div class="skeleton" :class="{ 'skeleton--circle': circle }" :style="skeletonStyle" aria-hidden="true" />
</template>

<style scoped>
.skeleton {
  flex-shrink: 0;
  background: linear-gradient(90deg, var(--color-bg-hover) 25%, var(--color-bg-primary) 50%, var(--color-bg-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}
.skeleton--circle { aspect-ratio: 1; }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
