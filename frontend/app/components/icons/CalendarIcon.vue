<template>
  <CalendarDaysIcon :size="size" />
</template>

<script setup lang="ts">
import { CalendarDaysIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
