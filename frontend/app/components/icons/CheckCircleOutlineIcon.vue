<template>
  <CircleCheckIcon :size="size" />
</template>

<script setup lang="ts">
import { CircleCheckIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
