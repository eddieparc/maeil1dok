<template>
  <ChevronLeftIcon :size="size" />
</template>

<script setup lang="ts">
import { ChevronLeftIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
