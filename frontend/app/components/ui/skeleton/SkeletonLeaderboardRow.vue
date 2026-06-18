<script setup lang="ts">
import Skeleton from './Skeleton.vue'
import SkeletonAvatar from './SkeletonAvatar.vue'

interface Props {
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  class: ''
})
</script>

<template>
  <div aria-hidden="true" :class="['flex items-center gap-3 w-full p-3 bg-card border border-default rounded-[12px]', props.class]">
    <div class="flex-shrink-0">
      <Skeleton width="28px" height="28px" rounded="full" />
    </div>
    
    <SkeletonAvatar size="sm" :withCaption="false" />
    
    <div class="flex-1 min-w-0 flex flex-col gap-1.5 justify-center">
      <Skeleton width="50%" height="1rem" />
      <Skeleton width="100%" height="0.375rem" rounded="full" />
    </div>
    
    <div class="flex-shrink-0 ml-2">
      <Skeleton width="2.5rem" height="1.25rem" />
    </div>
  </div>
</template>
