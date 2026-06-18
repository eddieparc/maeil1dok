<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import SkeletonAvatar from './SkeletonAvatar.vue'
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
    :class="['w-full flex flex-col items-center gap-4 p-6 bg-card border border-default rounded-[12px]', props.class]"
  >
    <span class="sr-only">로딩 중…</span>

    <!-- Avatar -->
    <SkeletonAvatar size="xl" :withCaption="false" />

    <!-- Name -->
    <Skeleton width="8rem" height="1.375rem" rounded="md" />

    <!-- Bio (2 lines, centered look) -->
    <div class="w-full max-w-xs">
      <SkeletonText :lines="2" lastLineWidth="50%" gap="0.5rem" />
    </div>

    <!-- Stats row (3 items) -->
    <div class="grid grid-cols-3 gap-4 w-full max-w-sm mt-2">
      <div v-for="i in 3" :key="i" class="flex flex-col items-center gap-2">
        <Skeleton width="2.5rem" height="1.5rem" />
        <Skeleton width="3rem" height="0.75rem" />
      </div>
    </div>

    <!-- Action button -->
    <Skeleton width="7rem" height="2.25rem" rounded="md" class="mt-2" />
  </div>
</template>
