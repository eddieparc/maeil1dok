<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import SkeletonAvatar from './SkeletonAvatar.vue'
import SkeletonText from './SkeletonText.vue'

interface Props {
  variant?: 'note' | 'bookmark' | 'highlight' | 'history' | 'user' | 'plan' | 'schedule'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'note',
  class: ''
})
</script>

<template>
  <div aria-hidden="true" :class="['w-full', props.class]">
    <!-- Note -->
    <div v-if="variant === 'note'" class="flex items-start gap-3 w-full">
      <SkeletonAvatar size="sm" :withCaption="false" />
      <div class="flex-1 min-w-0">
        <SkeletonText :lines="2" lastLineWidth="80%" />
      </div>
      <div class="flex-shrink-0 ml-2">
        <Skeleton width="3rem" height="0.875rem" />
      </div>
    </div>

    <!-- Bookmark -->
    <div v-else-if="variant === 'bookmark'" class="flex flex-col gap-2 w-full">
      <div class="flex items-center justify-between">
        <Skeleton width="4rem" height="1.25rem" rounded="full" />
        <Skeleton width="3rem" height="0.875rem" />
      </div>
      <Skeleton width="100%" height="1rem" />
    </div>

    <!-- Highlight -->
    <div v-else-if="variant === 'highlight'" class="flex items-start gap-3 w-full">
      <div class="flex-shrink-0 mt-1">
        <Skeleton width="0.75rem" height="0.75rem" rounded="full" />
      </div>
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <SkeletonText :lines="2" lastLineWidth="60%" />
        <Skeleton width="4rem" height="0.875rem" />
      </div>
    </div>

    <!-- History -->
    <div v-else-if="variant === 'history'" class="flex flex-col gap-3 w-full">
      <div class="flex items-center justify-between">
        <Skeleton width="5rem" height="1.25rem" rounded="full" />
        <Skeleton width="8rem" height="0.875rem" />
      </div>
      <Skeleton width="100%" height="0.5rem" rounded="full" />
    </div>

    <!-- User -->
    <div v-else-if="variant === 'user'" class="flex items-center gap-3 w-full">
      <SkeletonAvatar size="md" :withCaption="false" />
      <div class="flex-1 min-w-0">
        <SkeletonText :lines="2" lastLineWidth="40%" />
      </div>
      <div class="flex-shrink-0 ml-2">
        <Skeleton width="4rem" height="2rem" rounded="md" />
      </div>
    </div>

    <!-- Plan -->
    <div v-else-if="variant === 'plan'" class="flex flex-col gap-2 w-full">
      <div class="flex items-center justify-between">
        <Skeleton width="6rem" height="1.125rem" />
        <Skeleton width="3rem" height="0.875rem" />
      </div>
      <Skeleton width="100%" height="0.375rem" rounded="full" />
    </div>

    <!-- Schedule -->
    <div v-else-if="variant === 'schedule'" class="flex items-center gap-3 w-full">
      <div class="flex-shrink-0">
        <Skeleton width="1.25rem" height="1.25rem" rounded="sm" />
      </div>
      <div class="flex-1">
        <Skeleton width="60%" height="1rem" />
      </div>
      <div class="flex-shrink-0 ml-2">
        <Skeleton width="2.5rem" height="1.25rem" rounded="full" />
      </div>
    </div>
  </div>
</template>
