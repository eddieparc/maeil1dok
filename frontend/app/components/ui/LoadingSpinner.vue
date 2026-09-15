<script setup lang="ts">
import LoadingSpinner from '../common/LoadingSpinner.vue'

withDefaults(defineProps<{
  readonly size?: number
  readonly text?: string
  readonly inline?: boolean
  readonly fullscreen?: boolean
}>(), { size: 32, text: '', inline: false, fullscreen: false })
</script>

<template>
  <LoadingSpinner
    class="ui-loading-spinner" :class="{ inline, fullscreen }"
    :size="size" :text="text"
    :placement="fullscreen ? 'page' : inline ? 'inline' : 'section'"
  />
</template>

<style scoped>
.ui-loading-spinner { padding: calc(var(--card-padding) * 2); gap: 16px; }
.ui-loading-spinner :deep(.loading-text) { font-size: 15px; }
</style>
