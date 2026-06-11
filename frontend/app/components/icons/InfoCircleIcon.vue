<template>
  <CircleAlertIcon :size="size" />
</template>

<script setup lang="ts">
import { CircleAlertIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
