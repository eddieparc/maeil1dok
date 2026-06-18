<script setup lang="ts">
import Skeleton from './Skeleton.vue'

interface Props {
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  class: ''
})
</script>

<template>
  <div
    aria-hidden="true"
    :class="['flex items-center gap-3 w-full p-4 bg-card border border-default rounded-[12px]', props.class]"
  >
    <div class="flex-1 min-w-0 flex flex-col gap-2.5">
      <!-- Plan name + book count chip -->
      <div class="flex items-center gap-2">
        <Skeleton width="9rem" height="1.125rem" />
        <Skeleton width="2.75rem" height="1rem" rounded="full" />
      </div>

      <!-- Progress bar (long) -->
      <Skeleton width="100%" height="0.5rem" rounded="full" />

      <!-- Meta line -->
      <div class="flex items-center justify-between">
        <Skeleton width="5rem" height="0.75rem" />
        <Skeleton width="3rem" height="0.75rem" />
      </div>
    </div>

    <!-- Action button -->
    <div class="flex-shrink-0 ml-2">
      <Skeleton width="4.5rem" height="2.25rem" rounded="md" />
    </div>
  </div>
</template>
