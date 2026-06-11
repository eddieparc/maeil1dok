<template>
  <NuxtImg
    v-if="src && !hasError"
    :src="src"
    :alt="alt"
    :class="['user-avatar', sizeClass]"
    loading="lazy"
    @error="handleError"
  />
  <div v-else :class="['user-avatar-placeholder', sizeClass]">
    <UserIcon :size="iconSize" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UserIcon } from '@lucide/vue'

const props = withDefaults(defineProps<{
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  src: null,
  alt: '',
  size: 'md'
})

const hasError = ref(false)

const sizeClass = computed(() => `size-${props.size}`)
const iconSize = computed(() => {
  if (props.size === 'sm') return 16
  if (props.size === 'lg') return 28
  if (props.size === 'xl') return 36
  return 22
})

const handleError = () => {
  hasError.value = true
}

// 외부에서 src가 변경되면 에러 상태 초기화
watch(() => props.src, () => {
  hasError.value = false
})
</script>

<style scoped>
.user-avatar,
.user-avatar-placeholder {
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--gray-200);
  flex-shrink: 0;
}

.user-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  color: var(--primary-color);
}

/* 사이즈 */
.size-sm {
  width: 32px;
  height: 32px;
}
.size-sm.user-avatar-placeholder {
  font-size: 0.875rem;
}

.size-md {
  width: 48px;
  height: 48px;
}
.size-md.user-avatar-placeholder {
  font-size: 1.25rem;
}

.size-lg {
  width: 64px;
  height: 64px;
}
.size-lg.user-avatar-placeholder {
  font-size: 1.5rem;
}

.size-xl {
  width: 96px;
  height: 96px;
}
.size-xl.user-avatar-placeholder {
  font-size: 2rem;
}
</style>
