<template>
  <MonitorIcon :size="size" />
</template>

<script setup lang="ts">
import { MonitorIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
