<template>
  <BookmarkIcon :size="size" />
</template>

<script setup lang="ts">
import { BookmarkIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
