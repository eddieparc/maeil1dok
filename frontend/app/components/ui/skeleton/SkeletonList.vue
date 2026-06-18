<script setup lang="ts">
import SkeletonListItem from './SkeletonListItem.vue'

interface Props {
  count?: number
  variant?: 'note' | 'bookmark' | 'highlight' | 'history' | 'user' | 'plan' | 'schedule'
  gap?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  count: 5,
  variant: 'note',
  gap: '0.75rem',
  class: ''
})
</script>

<template>
  <div 
    role="status" 
    aria-busy="true" 
    :class="['flex flex-col', props.class]" 
    :style="{ gap }"
  >
    <span class="sr-only">로딩 중…</span>
    <SkeletonListItem
      v-for="i in count"
      :key="i"
      :variant="variant"
    />
  </div>
</template>
