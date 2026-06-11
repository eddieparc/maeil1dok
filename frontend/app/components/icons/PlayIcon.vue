<template>
  <PlayIcon :size="size" />
</template>

<script setup lang="ts">
import { PlayIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
