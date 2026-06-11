<template>
  <BookOpenIcon :size="size" />
</template>

<script setup lang="ts">
import { BookOpenIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
