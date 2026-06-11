<template>
  <SettingsIcon :size="size" />
</template>

<script setup lang="ts">
import { SettingsIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
