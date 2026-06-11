<template>
  <LockIcon :size="size" />
</template>

<script setup lang="ts">
import { LockIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
