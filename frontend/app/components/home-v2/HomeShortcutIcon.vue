<script setup lang="ts">
import { CalendarIcon, PlayIcon, MonitorIcon, UsersIcon, HistoryIcon } from '@lucide/vue';

defineProps<{ name: 'plan' | 'hasena' | 'intro' | 'groups' | 'history' }>();
const icons = { plan: CalendarIcon, hasena: PlayIcon, intro: MonitorIcon, groups: UsersIcon, history: HistoryIcon };
</script>

<template>
  <component :is="icons[name]" :size="18" aria-hidden="true" />
</template>
