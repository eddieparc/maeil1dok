<template>
  <Share2Icon :size="size" />
</template>

<script setup lang="ts">
import { Share2Icon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
