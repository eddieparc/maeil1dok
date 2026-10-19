<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="card"
    :class="[variantClass, { 'card-clickable': clickable, 'card-elevated': elevated }]"
    @click="handleClick"
  >
    <slot></slot>
  </component>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'gradient', 'gold', 'silver', 'bronze', 'primary'].includes(value)
  },
  clickable: {
    type: Boolean,
    default: false
  },
  elevated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const variantClass = computed(() => {
  return `card-${props.variant}`
})

const handleClick = (event) => {
  if (props.clickable) {
    emit('click', event)
  }
}
</script>

<style scoped>
.card {
  box-sizing: border-box;
  width: 100%;
  padding: var(--card-padding);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-card);
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
  font: inherit;
  letter-spacing: var(--tracking-body);
  text-align: left;
  transition: box-shadow var(--duration-micro) ease, transform var(--duration-micro) ease;
}

.card-elevated {
  box-shadow: var(--shadow-md);
}

.card-clickable {
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  cursor: pointer;
}

.card-clickable:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

.card-clickable:active {
  transform: scale(0.97);
}

.card:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  border-color: var(--color-accent-primary);
}

.card-gradient {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

.card-primary,
.card-gold {
  background: var(--color-accent-primary-light);
  color: var(--color-accent-primary);
}

.card-silver,
.card-bronze {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }

  .card-clickable:hover,
  .card-clickable:active {
    transform: none;
  }
}
</style>
