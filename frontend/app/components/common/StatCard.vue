<template>
  <Card :clickable="clickable" @click="handleClick" class="stat-card">
    <div class="stat-content">
      <div v-if="icon || $slots.icon" class="stat-icon" :style="{ color: iconColor }">
        <slot name="icon">
          <component :is="icon" v-if="icon" />
        </slot>
      </div>

      <StatValue :value="value" :label="label" class="stat-info" />
    </div>
  </Card>
</template>

<script setup>
import Card from './Card.vue'
import StatValue from '../ui/StatValue.vue'

const props = defineProps({
  icon: {
    type: [String, Object],
    default: null
  },
  iconColor: {
    type: String,
    default: 'var(--primary-color)'
  },
  value: {
    type: [String, Number],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  clickable: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = (event) => {
  if (props.clickable) {
    emit('click', event)
  }
}
</script>

<style scoped>
.stat-card {
  min-height: 100px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
}

.stat-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.stat-info :deep(.stat-value__line) {
  justify-content: center;
}
</style>
