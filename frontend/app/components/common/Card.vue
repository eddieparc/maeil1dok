<template>
  <component
    :is="clickable ? 'button' : 'div'"
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
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  transition: all var(--transition-normal);
  border: none;
  width: 100%;
  text-align: left;
  color: var(--color-text-primary);
}

.card-default {
  background: var(--color-bg-card);
  box-shadow: var(--shadow-sm);
}

.card-elevated {
  box-shadow: var(--shadow-md);
}

.card-clickable {
  cursor: pointer;
}

.card-clickable:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.card-clickable:active {
  transform: translateY(0);
}

.card-gradient {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-md);
}

.card-primary {
  background: linear-gradient(135deg, var(--color-accent-primary-light) 0%, var(--color-bg-tertiary) 100%);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.card-gold {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #8B4513;
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.card-silver {
  background: linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 100%);
  color: #4A5568;
  box-shadow: 0 4px 12px rgba(192, 192, 192, 0.3);
}

.card-bronze {
  background: linear-gradient(135deg, #CD7F32 0%, #B87333 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(205, 127, 50, 0.3);
}

@media (max-width: 640px) {
  .card {
    padding: 1rem;
  }
}

/* Tablet: Increased padding and border radius */
@media (min-width: 768px) {
  .card {
    padding: 1.75rem;
    border-radius: 1rem;
  }
}

/* Tablet Large: Even more padding */
@media (min-width: 1024px) {
  .card {
    padding: 2rem;
    border-radius: 1.25rem;
  }
}
</style>
