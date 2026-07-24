<template>
  <div class="empty-state-container" :class="{ fullscreen }">
    <div class="empty-icon">
      <slot name="icon">
        <InfoCircleIcon :size="48" />
      </slot>
    </div>
    <p class="empty-text">{{ text }}</p>
    <span v-if="hint" class="empty-hint">{{ hint }}</span>

    <!-- 사용 방법 가이드 (새로 추가) -->
    <div v-if="$slots.guide || guide" class="empty-guide">
      <slot name="guide">
        <div v-if="guide" class="guide-content">
          <div class="guide-step" v-for="(step, index) in guide" :key="index">
            <span class="step-number">{{ index + 1 }}</span>
            <span class="step-text">{{ step }}</span>
          </div>
        </div>
      </slot>
    </div>

    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text: string;
  hint?: string;
  fullscreen?: boolean;
  guide?: string[];
}>(), {
  hint: '',
  fullscreen: false,
  guide: undefined,
});
</script>

<style scoped>
.empty-state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary, #6b7280);
}

.empty-state-container.fullscreen {
  min-height: calc(100vh - 120px);
  min-height: calc(100dvh - 120px);
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary, #1f2937);
  margin: 0 0 0.5rem;
}

.empty-hint {
  font-size: 0.8125rem;
  opacity: 0.7;
  margin-bottom: 1rem;
}

/* 사용 가이드 스타일 */
.empty-guide {
  margin-top: 1.5rem;
  width: 100%;
  max-width: 280px;
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 10px;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--primary-color, #2A1111);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 50%;
  flex-shrink: 0;
}

.step-text {
  font-size: 0.8125rem;
  color: var(--text-primary, #1f2937);
  line-height: 1.5;
}

.empty-action {
  margin-top: 1.5rem;
}

/* 다크모드 */
:root.dark .guide-step {
  background: var(--color-bg-tertiary);
}
</style>
