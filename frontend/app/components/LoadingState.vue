<script setup lang="ts">
import LoadingSpinner from './common/LoadingSpinner.vue'

withDefaults(defineProps<{ readonly message?: string }>(), { message: '로딩 중...' })
</script>

<template>
  <LoadingSpinner class="loading-state" :size="40" :text="message" placement="section" />
</template>

<style scoped>
.loading-state { padding: 48px var(--card-padding); gap: 16px; }
</style>
