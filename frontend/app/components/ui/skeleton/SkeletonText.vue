<script setup lang="ts">
import Skeleton from './Skeleton.vue'

interface Props {
  lines?: number
  lastLineWidth?: string
  lineHeight?: string
  gap?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  lines: 3,
  lastLineWidth: '60%',
  lineHeight: '1rem',
  gap: '0.5rem',
  class: ''
})

const getLineWidth = (index: number) => {
  if (index === props.lines - 1 && props.lines > 1) {
    return props.lastLineWidth
  }
  
  if (index > 0 && index < props.lines - 1) {
    const widths = ['95%', '90%', '85%', '92%', '88%']
    return widths[index % widths.length]
  }
  
  return '100%'
}
</script>

<template>
  <div aria-hidden="true" :class="['flex flex-col', props.class]" :style="{ gap }">
    <Skeleton
      v-for="(_, index) in lines"
      :key="index"
      :width="getLineWidth(index)"
      :height="lineHeight"
      rounded="md"
    />
  </div>
</template>
