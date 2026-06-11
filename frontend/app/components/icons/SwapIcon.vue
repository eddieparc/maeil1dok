<template>
  <ArrowLeftRightIcon :size="size" />
</template>

<script setup lang="ts">
import { ArrowLeftRightIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
