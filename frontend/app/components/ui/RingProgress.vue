<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: number
  thickness?: number
  value: number
  label?: string
  sublabel?: string
}>(), { size: 88, thickness: 8, label: '', sublabel: '' })
const progress = computed(() => Math.min(100, Math.max(0, props.value)))
const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => circumference.value * (1 - progress.value / 100))
const accessibleLabel = computed(() => [props.label || `${progress.value}%`, props.sublabel].filter(Boolean).join(' '))
</script>

<template>
  <div class="ring-progress" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="accessibleLabel">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true" focusable="false">
      <circle class="ring-progress__track" :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="thickness" />
      <circle class="ring-progress__fill" :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="thickness" :stroke-dasharray="circumference" :stroke-dashoffset="offset" :style="{ opacity: progress === 0 ? 0 : 1 }" />
    </svg>
    <div class="ring-progress__center" aria-hidden="true">
      <slot :value="progress">
        <span class="ring-progress__label"><template v-if="label">{{ label }}</template><template v-else>{{ progress }}<span class="ring-progress__unit">%</span></template></span>
        <span v-if="sublabel" class="ring-progress__sublabel">{{ sublabel }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.ring-progress { position: relative; flex-shrink: 0; letter-spacing: var(--tracking-body); }
.ring-progress svg { display: block; transform: rotate(-90deg); }
.ring-progress circle { fill: none; }
.ring-progress__track { stroke: var(--color-bg-hover); }
.ring-progress__fill { stroke: var(--color-accent-primary); stroke-linecap: round; transition: stroke-dashoffset var(--duration-enter) var(--ease-out-quint); }
.ring-progress__center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--color-text-primary); }
.ring-progress__label { font-size: 24px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.6px; }
.ring-progress__unit { margin-left: 1px; font-size: 13px; font-weight: 600; }
.ring-progress__sublabel { font-size: 11px; line-height: 1.4; color: var(--color-text-secondary); }
@media (prefers-reduced-motion: reduce) {
  .ring-progress__fill { transition: none; }
}
</style>
