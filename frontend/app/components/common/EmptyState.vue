<template>
  <div class="empty-state fade-in" :class="{ fullscreen, 'empty-state-container guide-cards': presentation === 'cards' }">
    <div class="empty-icon">
      <slot name="icon">
        <Info :size="32" :stroke-width="1.5" aria-hidden="true" />
      </slot>
    </div>

    <h3 class="empty-title">{{ resolvedTitle }}</h3>

    <p v-if="resolvedDescription" class="empty-description">{{ resolvedDescription }}</p>

    <div v-if="$slots.guide || guide?.length" class="empty-guide">
      <slot name="guide">
        <ol v-if="guide?.length" class="empty-guide__steps">
          <li v-for="(step, index) in guide" :key="index">
            <span v-if="presentation === 'cards'" class="step-number" aria-hidden="true">{{ index + 1 }}</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </slot>
    </div>

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
import { computed } from 'vue'
import { Info } from '@lucide/vue'
import AppButton from '../ui/AppButton.vue'

const props = defineProps({
  title: {
    type: String,
    default: undefined
  },
  description: {
    type: String,
    default: undefined
  },
  text: { type: String, default: '데이터가 없습니다' },
  hint: { type: String, default: '' },
  guide: { type: Array, default: undefined },
  fullscreen: { type: Boolean, default: false },
  presentation: { type: String, default: 'list' },
  actionText: {
    type: String,
    default: ''
  }
})

// Explicit modern props (including empty strings) override legacy aliases.
const resolvedTitle = computed(() => props.title ?? props.text)
const resolvedDescription = computed(() => props.description ?? props.hint)

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

.empty-state.fullscreen {
  min-height: calc(100vh - 120px);
  min-height: calc(100dvh - 120px);
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

.empty-guide {
  width: 100%;
  max-width: 400px;
  margin-top: var(--card-padding);
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}

.empty-guide__steps { margin: 0; padding-left: 24px; }
.empty-guide__steps li + li { margin-top: 12px; }
.empty-guide__steps li::marker { color: var(--color-accent-primary); font-weight: 600; }

.empty-action {
  margin-top: var(--card-padding);
}

.guide-cards { min-height: 300px; }
.guide-cards .empty-icon { width: auto; height: auto; background: none; opacity: 0.5; }
.guide-cards .empty-icon :deep(svg) { width: 48px; height: 48px; }
.guide-cards .empty-title { font-size: 15px; font-weight: 500; }
.guide-cards .empty-description { font-size: 13px; }
.guide-cards .empty-guide { max-width: 280px; margin-top: 24px; }
.guide-cards .empty-guide__steps { padding: 0; list-style: none; }
.guide-cards li { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: var(--color-bg-secondary); border-radius: var(--radius-control); font-size: 13px; }
.step-number { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: var(--radius-pill); background: var(--color-accent-primary); color: var(--color-text-inverse); font-size: 12px; font-weight: 600; }

@media (prefers-reduced-motion: reduce) {
  .empty-state {
    animation: none;
    transition: none;
  }
}
</style>
