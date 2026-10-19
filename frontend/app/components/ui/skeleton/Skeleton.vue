<script setup lang="ts">
import BaseSkeleton from '~/components/ui/Skeleton.vue'

interface Props {
  width?: string | number
  height?: string | number
  radius?: string | number
  circle?: boolean
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: '1rem',
  rounded: 'md',
  class: ''
})
</script>

<template>
  <BaseSkeleton
    :width="width"
    :height="height"
    :radius="radius"
    :circle="circle"
    :rounded="rounded"
    :class="props.class"
  />
</template>
