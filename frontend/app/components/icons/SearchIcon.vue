<template>
  <SearchIcon :size="size" />
</template>

<script setup lang="ts">
import { SearchIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
