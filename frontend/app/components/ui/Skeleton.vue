<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  width?: string | number
  height?: string | number
  radius?: string | number
  circle?: boolean
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}>(), { width: '100%', radius: 'var(--radius-control)' })
const dimension = (value: string | number) => typeof value === 'number' ? `${value}px` : value
const roundedRadius = computed(() => ({
  sm: 'var(--radius-cell)',
  md: 'var(--radius-control)',
  lg: '12px',
  xl: '16px',
  full: 'var(--radius-pill)',
})[props.rounded ?? 'md'])
const skeletonStyle = computed(() => ({
  width: dimension(props.width),
  height: props.height !== undefined ? dimension(props.height) : props.circle ? undefined : '16px',
  borderRadius: props.circle ? '50%' : props.rounded ? roundedRadius.value : dimension(props.radius),
}))
</script>

<template>
  <div class="skeleton-shimmer skeleton" :class="{ 'skeleton--circle': circle }" :style="skeletonStyle" aria-hidden="true" />
</template>

<style scoped>
.skeleton-shimmer.skeleton {
  flex-shrink: 0;
}
.skeleton--circle { aspect-ratio: 1; }
</style>
