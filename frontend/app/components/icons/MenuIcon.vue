<template>
  <MenuIcon :size="size" />
</template>

<script setup lang="ts">
import { MenuIcon } from '@lucide/vue';

withDefaults(defineProps<{
  size?: number | string;
}>(), {
  size: 20
});
</script>
