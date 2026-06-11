<template>
  <ListIcon :size="size" />
</template>

<script setup lang="ts">
import { ListIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
