<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'white' | 'gray'
  text?: string
  fullScreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'primary',
  fullScreen: false
})

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4'
}

const colorClasses = {
  primary: 'border-[var(--color-accent-primary)] border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent'
}
</script>

<template>
  <div
    :class="[
      'flex flex-col items-center justify-center gap-3',
      fullScreen ? 'fixed inset-0 bg-white/80 z-50' : ''
    ]"
    role="status"
    aria-live="polite"
  >
    <div
      :class="[
        'rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color]
      ]"
      aria-hidden="true"
    />
    <span v-if="text" class="text-gray-600 text-sm">{{ text }}</span>
    <span class="sr-only">{{ text || '로딩 중...' }}</span>
  </div>
</template>
