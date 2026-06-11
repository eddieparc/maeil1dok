<template>
  <CopyIcon :size="size" />
</template>

<script setup lang="ts">
import { CopyIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
