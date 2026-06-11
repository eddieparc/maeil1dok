<template>
  <CheckIcon :size="size" />
</template>

<script setup lang="ts">
import { CheckIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
