<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  width?: string
  height?: string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  rounded: 'md',
  class: ''
})

const roundedClass = computed(() => {
  const map: Record<string, string> = {
    sm: 'rounded-[4px]',
    md: 'rounded-[8px]',
    lg: 'rounded-[12px]',
    xl: 'rounded-[16px]',
    full: 'rounded-full'
  }
  return map[props.rounded] || 'rounded-[8px]'
})
</script>

<template>
  <div
    aria-hidden="true"
    :class="['skeleton-shimmer', roundedClass, props.class]"
    :style="{ width, height }"
  ></div>
</template>
