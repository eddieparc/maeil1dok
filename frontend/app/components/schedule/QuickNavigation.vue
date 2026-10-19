<script setup lang="ts">
import { CalendarDays, ListChecks, LocateFixed } from '@lucide/vue';
import type { ScrollTarget } from '~/types/plan';
defineProps<{ showCurrentLocation?: boolean; disabled?: boolean }>();
defineEmits<{ scrollTo: [target: ScrollTarget] }>();
</script>
<template>
  <div class="control-buttons">
    <button v-if="showCurrentLocation" type="button" class="control-button" data-target="currentLocation" :disabled="disabled" aria-label="현재 읽는 위치로 이동" @click="$emit('scrollTo', 'currentLocation')"><LocateFixed :size="13" aria-hidden="true" />현재 위치</button>
    <button type="button" class="control-button" data-target="today" :disabled="disabled" aria-label="오늘 일정으로 이동" @click="$emit('scrollTo', 'today')"><CalendarDays :size="13" aria-hidden="true" />오늘</button>
    <button type="button" class="control-button" data-target="lastIncomplete" :disabled="disabled" aria-label="마지막 미완료 일정으로 이동" @click="$emit('scrollTo', 'lastIncomplete')"><ListChecks :size="13" aria-hidden="true" />마지막 미완료</button>
  </div>
</template>
<style scoped>
.control-buttons { display: flex; gap: 4px; flex-wrap: wrap; }
.control-button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: var(--hit-min); min-height: 32px; padding: 4px 8px; border: 1px solid transparent; border-radius: var(--radius-control); background: var(--color-accent-bg); color: var(--color-accent-primary); font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: background-color .15s, transform .15s; }
.control-button:hover:not(:disabled) { border-color: var(--color-accent-primary); }
.control-button:active:not(:disabled) { transform: scale(.97); }
.control-button:disabled { opacity: .5; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { .control-button { transition: none; } .control-button:active:not(:disabled) { transform: none; } }
</style>
