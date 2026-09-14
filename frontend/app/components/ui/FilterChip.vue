<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
  active?: boolean
  count?: number | string
  disabled?: boolean
}>(), { label: '' })
defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <button type="button" class="filter-chip" :class="{ 'filter-chip--active': active }" :aria-pressed="active" :disabled="disabled" @click="!disabled && $emit('click', $event)">
    <slot>{{ label }}</slot>
    <span v-if="count !== undefined" class="filter-chip__count">{{ count }}</span>
  </button>
</template>

<style scoped>
.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  height: var(--hit-min);
  min-height: var(--hit-min);
  min-width: var(--hit-min);
  padding: 0 16px;
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-pill);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: var(--tracking-body);
  cursor: pointer;
  transition: background-color var(--duration-micro) ease, color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.filter-chip:hover:not(:disabled) { background: var(--color-bg-hover); }
.filter-chip--active { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: var(--color-text-inverse); }
.filter-chip--active:hover:not(:disabled) { background: var(--color-accent-primary-hover); }
.filter-chip:active:not(:disabled) { transform: scale(0.97); }
.filter-chip:disabled { opacity: 0.5; cursor: not-allowed; }
[data-theme="dark"] .filter-chip--active { border: 1.5px solid var(--color-accent-primary); background: transparent; color: var(--color-accent-primary); }
[data-theme="dark"] .filter-chip--active:hover:not(:disabled) { background: var(--color-bg-hover); }
.filter-chip:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.filter-chip__count { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  .filter-chip { transition: none; }
  .filter-chip:active:not(:disabled) { transform: none; }
}
</style>
