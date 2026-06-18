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
    role="status"
    aria-busy="true"
    :class="['w-full flex flex-col gap-5', props.class]"
  >
    <span class="sr-only">로딩 중…</span>

    <!-- 16:9 video placeholder -->
    <div class="w-full aspect-video">
      <Skeleton width="100%" height="100%" rounded="lg" />
    </div>

    <!-- Title -->
    <Skeleton width="60%" height="1.5rem" rounded="md" />

    <!-- Body paragraphs (3 groups) -->
    <div class="flex flex-col gap-4">
      <SkeletonText :lines="3" lastLineWidth="65%" gap="0.5rem" />
      <SkeletonText :lines="3" lastLineWidth="55%" gap="0.5rem" />
      <SkeletonText :lines="3" lastLineWidth="70%" gap="0.5rem" />
    </div>

    <!-- AI summary block -->
    <div class="bg-card border border-default rounded-[12px] p-4 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Skeleton width="1.25rem" height="1.25rem" rounded="sm" />
        <Skeleton width="6rem" height="1rem" />
      </div>
      <SkeletonText :lines="5" lastLineWidth="50%" gap="0.5rem" />
    </div>

    <!-- Nav row (prev / next) -->
    <div class="flex items-center justify-between gap-3 pt-2">
      <Skeleton width="6rem" height="2.25rem" rounded="md" />
      <Skeleton width="6rem" height="2.25rem" rounded="md" />
    </div>
  </div>
</template>
