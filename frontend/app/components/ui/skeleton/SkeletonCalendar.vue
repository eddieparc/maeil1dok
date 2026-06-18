<script setup lang="ts">
import Skeleton from './Skeleton.vue'

interface Props {
  weeks?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  weeks: 5,
  class: ''
})
</script>

<template>
  <div role="status" aria-busy="true" :class="['w-full', props.class]">
    <span class="sr-only">로딩 중…</span>
    
    <div class="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
      <div v-for="i in 7" :key="`header-${i}`" class="flex justify-center py-2">
        <Skeleton width="1.5rem" height="0.875rem" />
      </div>
    </div>
    
    <div class="grid grid-cols-7 gap-1 sm:gap-2">
      <div v-for="i in weeks * 7" :key="`day-${i}`" class="aspect-square w-full">
        <Skeleton width="100%" height="100%" rounded="md" />
      </div>
    </div>
  </div>
</template>
