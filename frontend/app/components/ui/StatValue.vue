<script setup lang="ts">
withDefaults(defineProps<{
  value: number | string
  unit?: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
}>(), { unit: '', label: '', size: 'md' })
</script>

<template>
  <div class="stat-value" :class="`stat-value--${size}`">
    <div class="stat-value__line">
      <span class="stat-value__number">{{ value }}</span>
      <span v-if="unit" class="stat-value__unit">{{ unit }}</span>
    </div>
    <div v-if="label" class="stat-value__label">{{ label }}</div>
  </div>
</template>

<style scoped>
.stat-value { color: var(--color-text-primary); letter-spacing: var(--tracking-body); }
.stat-value__line { display: flex; align-items: baseline; gap: 3px; line-height: 1; }
.stat-value__number { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.6px; }
.stat-value--sm .stat-value__number { font-size: 20px; }
.stat-value--lg .stat-value__number { font-size: 40px; letter-spacing: -1px; }
.stat-value__unit { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
.stat-value__label { margin-top: 6px; font-size: 12px; font-weight: 500; line-height: 1.4; color: var(--color-text-secondary); }
@media (prefers-reduced-motion: reduce) {
  .stat-value { animation: none; transition: none; }
}
</style>
