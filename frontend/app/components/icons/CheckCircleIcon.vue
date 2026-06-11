<template>
  <CircleCheckBigIcon :size="size" />
</template>

<script setup lang="ts">
import { CircleCheckBigIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
