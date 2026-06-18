<script setup lang="ts">
import { computed, useSlots } from 'vue'
import Skeleton from './Skeleton.vue'
import SkeletonText from './SkeletonText.vue'

interface Props {
  padding?: string
  rounded?: 'lg' | 'xl'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  padding: '1.5rem',
  rounded: 'lg',
  class: ''
})

const slots = useSlots()
const hasHeader = computed(() => !!slots.header)
const hasBody = computed(() => !!slots.body)
const hasFooter = computed(() => !!slots.footer)
const hasCustomContent = computed(() => hasHeader.value || hasBody.value || hasFooter.value)

const roundedClass = computed(() => {
  return props.rounded === 'xl' ? 'rounded-[16px]' : 'rounded-[12px]'
})
</script>

<template>
  <div
    aria-hidden="true"
    :class="['bg-card border border-default shadow-sm flex flex-col', roundedClass, props.class]"
    :style="{ padding }"
  >
    <template v-if="hasCustomContent">
      <div v-if="hasHeader" class="mb-4">
        <slot name="header"></slot>
      </div>
      <div v-if="hasBody" class="flex-1">
        <slot name="body"></slot>
      </div>
      <div v-if="hasFooter" class="mt-4 pt-4 border-t border-light">
        <slot name="footer"></slot>
      </div>
    </template>
    <template v-else>
      <div class="mb-4">
        <Skeleton width="40%" height="1.25rem" />
      </div>
      <div class="flex-1">
        <SkeletonText :lines="3" lastLineWidth="70%" />
      </div>
    </template>
  </div>
</template>
