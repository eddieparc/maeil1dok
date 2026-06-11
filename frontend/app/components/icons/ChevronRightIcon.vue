<template>
  <ChevronRightIcon :size="size" />
</template>

<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
