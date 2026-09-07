<template>
  <ReadingSettingsSheet
    :model-value="isOpen"
    :current-version="currentVersion"
    @update:model-value="handleModelValueUpdate"
  />
</template>

<script setup lang="ts">
import ReadingSettingsSheet from '~/components/ReadingSettingsSheet.vue'

defineProps<{ isOpen: boolean; currentVersion: string }>()
const emit = defineEmits<{ close: [] }>()
const handleModelValueUpdate = (open: boolean) => {
  if (!open) emit('close')
}
</script>
