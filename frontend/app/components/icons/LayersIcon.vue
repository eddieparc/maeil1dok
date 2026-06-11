<template>
  <LayersIcon :size="size" />
</template>

<script setup lang="ts">
import { LayersIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
