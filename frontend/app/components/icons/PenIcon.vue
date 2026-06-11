<template>
  <PenLineIcon :size="size" />
</template>

<script setup lang="ts">
import { PenLineIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
