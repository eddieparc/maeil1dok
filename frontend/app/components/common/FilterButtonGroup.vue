<template>
  <div class="filter-button-group" :class="groupClass">
    <div v-if="label" class="filter-label">{{ label }}</div>
    <div class="filter-buttons" role="group" :aria-label="label || undefined">
      <FilterChip
        v-for="option in options"
        :key="option.value"
        class="filter-button"
        :class="{ active: modelValue === option.value }"
        :active="modelValue === option.value"
        @click="handleSelect(option.value)"
      >
        {{ option.label }}
      </FilterChip>
    </div>
  </div>
</template>

<script setup>
import FilterChip from '../ui/FilterChip.vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    required: true
  },
  options: {
    type: Array,
    required: true,
    validator: (value) => value.every(opt => opt.label && opt.value !== undefined)
  },
  label: {
    type: String,
    default: ''
  },
  groupClass: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue'])

const handleSelect = (value) => {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.filter-button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  letter-spacing: var(--tracking-body);
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-button {
  white-space: nowrap;
}
</style>
