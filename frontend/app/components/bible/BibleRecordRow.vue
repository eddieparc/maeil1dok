<template>
  <li class="record-row" :style="{ '--record-delay': `${80 + index * 50}ms` }">
    <NuxtLink :to="to" class="record-link" :class="{ 'has-actions': $slots.trailing }">
      <div class="record-header"><slot name="location" /><slot name="date" /></div>
      <slot name="body" />
      <slot name="badges" />
    </NuxtLink>
    <div v-if="$slots.trailing" class="record-actions"><slot name="trailing" /></div>
  </li>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
defineProps<{ readonly to: RouteLocationRaw; readonly index: number }>();
</script>

<style scoped>
.record-row { position: relative; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); animation: record-enter var(--duration-enter) var(--ease-out-quint) both; animation-delay: var(--record-delay); transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease; }
.record-link { display: block; min-height: 44px; padding: 16px 18px; border-radius: inherit; color: inherit; text-decoration: none; }
.record-link.has-actions { padding-right: 52px; }
.record-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.record-actions { position: absolute; top: 5px; right: 4px; }
.record-row:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
.record-link:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.record-link:active { transform: scale(.97); }
@keyframes record-enter { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .record-row { animation-name: record-fade; transition: none; }
  .record-row:hover, .record-link:active { transform: none; }
  @keyframes record-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
