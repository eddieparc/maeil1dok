<template>
  <HistoryIcon :size="size" />
</template>

<script setup lang="ts">
import { HistoryIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
