<template>
  <ReadingSettingsSheet :model-value="isOpen" @update:model-value="closeSheet" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ReadingSettingsSheet from '~/components/ReadingSettingsSheet.vue'

definePageMeta({ layout: 'default' })
const router = useRouter()
const isOpen = ref(true)
const closeSheet = (open: boolean) => {
  if (open || !isOpen.value) return
  isOpen.value = false
  if (window.history.state?.back) router.back()
  else router.replace('/bible')
}
</script>
