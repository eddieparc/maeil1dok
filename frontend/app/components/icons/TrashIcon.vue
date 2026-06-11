<template>
  <Trash2Icon :size="size" />
</template>

<script setup lang="ts">
import { Trash2Icon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
