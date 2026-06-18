<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import SkeletonText from './SkeletonText.vue'

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
    :class="['bg-card border border-default shadow-sm rounded-[12px] overflow-hidden flex flex-col', props.class]"
  >
    <!-- 16:9 image placeholder -->
    <div class="w-full aspect-video">
      <Skeleton width="100%" height="100%" rounded="sm" class="!rounded-none" />
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-3 p-4">
      <!-- Title -->
      <Skeleton width="70%" height="1.25rem" rounded="md" />

      <!-- Meta lines -->
      <SkeletonText :lines="2" lastLineWidth="55%" gap="0.5rem" />

      <!-- Footer action -->
      <div class="flex items-center justify-between pt-2">
        <Skeleton width="4.5rem" height="0.875rem" />
        <Skeleton width="5rem" height="2rem" rounded="md" />
      </div>
    </div>
  </div>
</template>
