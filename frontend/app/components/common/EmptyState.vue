<template>
  <div class="empty-state fade-in">
    <div class="empty-icon">
      <slot name="icon">
        <Info :size="32" :stroke-width="1.5" aria-hidden="true" />
      </slot>
    </div>

    <h3 class="empty-title">{{ title }}</h3>

    <p v-if="description" class="empty-description">{{ description }}</p>

    <div v-if="actionText || $slots.action" class="empty-action">
      <slot name="action">
        <AppButton v-if="actionText" @click="handleAction" class="empty-button">
          {{ actionText }}
        </AppButton>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { Info } from '@lucide/vue'
import AppButton from '../ui/AppButton.vue'

const props = defineProps({
  title: {
    type: String,
    default: '데이터가 없습니다'
  },
  description: {
    type: String,
    default: ''
  },
  actionText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['action'])

const handleAction = () => {
  emit('action')
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  padding: calc(var(--card-padding) * 2) var(--card-padding);
  color: var(--color-text-primary);
  letter-spacing: var(--tracking-body);
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--card-padding);
  border-radius: var(--radius-pill);
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
}

.empty-icon :deep(svg) {
  width: 32px;
  height: 32px;
}

.empty-title {
  margin: 0 0 8px;
  color: var(--color-text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: var(--tracking-display);
}

.empty-description {
  max-width: 400px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.empty-action {
  margin-top: var(--card-padding);
}

@media (prefers-reduced-motion: reduce) {
  .empty-state {
    animation: none;
    transition: none;
  }
}
</style>
