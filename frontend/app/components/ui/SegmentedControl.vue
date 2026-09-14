<script setup lang="ts">
import { computed } from 'vue'

type Value = string | number
const props = defineProps<{
  modelValue: Value
  options: Array<{ value: Value; label: string; disabled?: boolean; id?: string; controls?: string }>
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Value] }>()
const activeIndex = computed(() => props.options.findIndex(option => option.value === props.modelValue))
const enabledIndices = computed(() => props.options.flatMap((option, index) => !props.disabled && !option.disabled ? [index] : []))
const focusIndex = computed(() => enabledIndices.value.includes(activeIndex.value) ? activeIndex.value : (enabledIndices.value[0] ?? -1))
const thumbStyle = computed(() => ({
  width: `${100 / props.options.length}%`,
  transform: `translateX(${activeIndex.value * 100}%)`,
}))
function select(index: number) {
  if (enabledIndices.value.includes(index)) emit('update:modelValue', props.options[index]!.value)
}
function onKeydown(event: KeyboardEvent, index: number) {
  const enabled = enabledIndices.value
  const position = enabled.indexOf(index)
  if (position < 0) return
  let next: number
  switch (event.key) {
    case 'ArrowRight': next = enabled[(position + 1) % enabled.length]!; break
    case 'ArrowLeft': next = enabled[(position + enabled.length - 1) % enabled.length]!; break
    case 'Home': next = enabled[0]!; break
    case 'End': next = enabled[enabled.length - 1]!; break
    default: return
  }
  event.preventDefault()
  select(next)
  const target = event.currentTarget as HTMLElement
  target.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
</script>

<template>
  <div class="segmented-control" role="tablist" aria-orientation="horizontal">
    <div class="segmented-control__thumb-track" aria-hidden="true">
      <span v-if="activeIndex >= 0" class="segmented-control__thumb" :style="thumbStyle" />
    </div>
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="tab"
      class="segmented-control__option"
      :id="option.id"
      :aria-controls="option.controls"
      :disabled="disabled || option.disabled"
      :aria-selected="option.value === modelValue"
      :tabindex="index === focusIndex ? 0 : -1"
      @click="select(index)"
      @keydown="onKeydown($event, index)"
    >{{ option.label }}</button>
  </div>
</template>

<style scoped>
.segmented-control {
  position: relative;
  display: flex;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--color-bg-tertiary);
  letter-spacing: var(--tracking-body);
}
.segmented-control__thumb-track { position: absolute; inset: 3px; pointer-events: none; }
.segmented-control__thumb {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: var(--radius-pill);
  background: var(--color-bg-card);
  box-shadow: var(--shadow-segment-thumb);
  transition: transform var(--duration-micro) var(--ease-decelerate);
}
.segmented-control__option {
  position: relative;
  flex: 1 1 0;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.segmented-control__option[aria-selected="true"],
.segmented-control__option:hover:not(:disabled) { color: var(--color-accent-primary); }
.segmented-control__option:active:not(:disabled) { transform: scale(0.97); }
.segmented-control__option:disabled { opacity: 0.5; cursor: not-allowed; }
.segmented-control__option:focus-visible { outline: 3px solid var(--color-accent-focus-ring); border-color: var(--color-accent-primary); outline-offset: 1px; }
[data-theme="dark"] .segmented-control__option[aria-selected="true"] { border: 1.5px solid var(--color-accent-primary); }
@media (prefers-reduced-motion: reduce) {
  .segmented-control__thumb, .segmented-control__option { transition: none; }
  .segmented-control__option:active:not(:disabled) { transform: none; }
}
</style>
