<template>
  <LoaderCircleIcon :size="size" class="spinner-icon" />
</template>

<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>

<style scoped>
.spinner-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
