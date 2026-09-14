<script setup lang="ts">
import Skeleton from './Skeleton.vue'

interface Props {
  count?: number
  announce?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  count: 3,
  announce: true,
  class: ''
})
</script>

<template>
  <div
    :role="announce ? 'status' : undefined"
    :aria-busy="announce ? 'true' : undefined"
    :class="['skeleton-stats grid gap-4 w-full', props.class]"
    :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }"
  >
    <span v-if="announce" class="sr-only">통계를 불러오는 중</span>
    <div
      v-for="i in count"
      :key="i"
      class="flex flex-col items-center justify-center p-4 bg-card border border-default rounded-[12px] shadow-sm gap-2"
    >
      <Skeleton width="3rem" height="0.875rem" />
      <Skeleton width="4rem" height="1.75rem" />
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 479px) {
  .skeleton-stats {
    grid-template-columns: 1fr !important;
  }
}
</style>
