<template>
  <FileTextIcon :size="size" />
</template>

<script setup lang="ts">
import { FileTextIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
