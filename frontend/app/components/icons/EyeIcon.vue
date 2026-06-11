<template>
  <EyeIcon :size="size" />
</template>

<script setup lang="ts">
import { EyeIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
