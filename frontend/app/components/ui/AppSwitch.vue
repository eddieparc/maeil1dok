<script setup lang="ts">
import { useId } from 'vue'

const props = defineProps<{
  modelValue: boolean
  label: string
  description?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const controlId = useId()
const labelId = `${controlId}-label`
const descriptionId = `${controlId}-description`

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <div class="app-switch" :class="{ 'app-switch--disabled': disabled }">
    <label class="app-switch__text" :for="controlId">
      <span :id="labelId" class="app-switch__label">{{ label }}</span>
      <span v-if="description" :id="descriptionId" class="app-switch__description">{{ description }}</span>
    </label>
    <button
      :id="controlId"
      type="button"
      role="switch"
      class="app-switch__control"
      :aria-checked="modelValue"
      :aria-labelledby="labelId"
      :aria-describedby="description ? descriptionId : undefined"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="app-switch__track" aria-hidden="true"><span class="app-switch__thumb" /></span>
    </button>
  </div>
</template>

<style scoped>
.app-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
  letter-spacing: var(--tracking-body);
}
.app-switch__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.app-switch__label { font-size: 15px; font-weight: 600; line-height: 1.5; color: var(--color-text-primary); }
.app-switch__description { font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
.app-switch__control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  cursor: pointer;
}
.app-switch__track {
  display: block;
  width: 40px;
  height: 24px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  background: var(--color-border-default);
  transition: background-color var(--duration-micro) ease;
}
.app-switch__thumb {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-sm);
  transition: transform var(--duration-micro) ease;
}
.app-switch__control[aria-checked="true"] .app-switch__track { background: var(--color-accent-primary); }
.app-switch__control[aria-checked="true"] .app-switch__thumb { transform: translateX(16px); }
.app-switch__control:hover:not(:disabled) { background: var(--color-bg-hover); }
.app-switch__control:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.app-switch__control:disabled { opacity: 0.5; cursor: not-allowed; }
.app-switch--disabled .app-switch__text { cursor: not-allowed; }
.app-switch--disabled .app-switch__label { color: var(--color-text-secondary); }
@media (prefers-reduced-motion: reduce) {
  .app-switch__track, .app-switch__thumb { transition: none; }
}
</style>
