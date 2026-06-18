<script setup lang="ts">
import { computed } from 'vue'
import Skeleton from './Skeleton.vue'
import SkeletonText from './SkeletonText.vue'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  withCaption?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  withCaption: false,
  class: ''
})

const sizeValue = computed(() => {
  const map: Record<string, string> = {
    sm: '32px',
    md: '40px',
    lg: '56px',
    xl: '80px'
  }
  return map[props.size] || '40px'
})
</script>

<template>
  <div aria-hidden="true" :class="['flex items-center gap-3', props.class]">
    <Skeleton
      :width="sizeValue"
      :height="sizeValue"
      rounded="full"
      class="flex-shrink-0"
    />
    <div v-if="withCaption" class="flex-1 min-w-0">
      <SkeletonText :lines="2" lastLineWidth="40%" gap="0.375rem" />
    </div>
  </div>
</template>
