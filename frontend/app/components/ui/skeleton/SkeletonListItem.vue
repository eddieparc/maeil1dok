<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import SkeletonAvatar from './SkeletonAvatar.vue'
import SkeletonText from './SkeletonText.vue'

interface Props {
  variant?: 'default' | 'note' | 'bookmark' | 'highlight' | 'history' | 'user' | 'plan' | 'schedule' | 'summary' | 'video'
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
    <div v-if="variant === 'note' || variant === 'default'" class="flex items-start gap-3 w-full">
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

    <!-- Admin summary -->
    <div v-else-if="variant === 'summary'" class="flex flex-col gap-3 w-full p-4 bg-card border border-default rounded-[12px]">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <Skeleton width="5rem" height="1rem" />
          <Skeleton width="7rem" height="0.75rem" />
        </div>
        <Skeleton width="8rem" height="2rem" rounded="md" />
      </div>
      <SkeletonText :lines="3" lastLineWidth="65%" />
      <Skeleton width="12rem" height="0.75rem" />
    </div>

    <!-- Video intro -->
    <div v-else class="flex items-center justify-between gap-4 w-full p-4 bg-card border border-default rounded-[12px]">
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton width="35%" height="1.25rem" />
        <Skeleton width="65%" height="0.875rem" />
        <Skeleton width="45%" height="0.875rem" />
      </div>
      <Skeleton width="4rem" height="2rem" rounded="md" />
    </div>
  </div>
</template>
