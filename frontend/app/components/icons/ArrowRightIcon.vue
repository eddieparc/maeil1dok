<template>
  <ArrowRightIcon :size="size" />
</template>

<script setup lang="ts">
import { ArrowRightIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
