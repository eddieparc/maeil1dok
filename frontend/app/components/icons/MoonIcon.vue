<template>
  <MoonIcon :size="size" />
</template>

<script setup lang="ts">
import { MoonIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
