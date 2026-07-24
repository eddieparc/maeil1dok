<template>
  <div class="catchup-progress-card">
    <div class="card-header">
      <span class="header-icon">🏃</span>
      <h3 class="header-title">{{ session.name }}</h3>
    </div>

    <div class="progress-container">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${session.progress_percentage}%` }"
        />
      </div>
      <div class="progress-text">
        <span class="progress-percent">{{ session.progress_percentage }}%</span>
        <span class="progress-count">({{ session.completed_count }}/{{ session.total_count }})</span>
      </div>
    </div>

    <div class="plan-info">
      <template v-if="session.strategy === 'parallel'">
        <span class="info-label">원본:</span>
        <span class="plan-name strike">{{ session.plan_name }}</span>
      </template>
      <template v-else>
        <span class="info-icon">📅</span>
        <span class="rejoin-info">
          {{ formatDate(session.target_rejoin_date) }}에 원본 플랜과 합류 예정
        </span>
      </template>
    </div>

    <div class="card-actions">
      <button class="action-button secondary" @click="emit('edit')">
        <span class="action-icon">⚙️</span>
        계획수정
      </button>
      <button class="action-button primary" @click="emit('complete')">
        <span class="action-icon">✅</span>
        따라잡기완료
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CatchupSession } from '~/composables/useCatchup'

const props = defineProps<{
  session: CatchupSession
}>()

const emit = defineEmits<{
  edit: []
  complete: []
}>()

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}
</script>

<style scoped>
.catchup-progress-card {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--color-border, #e5e7eb);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.header-icon {
  font-size: 1.5rem;
}

.header-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.progress-container {
  margin-bottom: 1rem;
}

.progress-bar {
  height: 12px;
  background: var(--color-bg-tertiary, #e5e7eb);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary, #2A1111), var(--color-primary-light, #2A1111));
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.progress-percent {
  font-weight: 600;
  color: var(--color-primary, #2A1111);
}

.progress-count {
  color: var(--color-text-secondary, #6b7280);
}

.plan-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.info-label {
  color: var(--color-text-secondary, #6b7280);
}

.info-icon {
  font-size: 1rem;
}

.plan-name {
  color: var(--color-text-primary, #111827);
}

.plan-name.strike {
  text-decoration: line-through;
  color: var(--color-text-tertiary, #9ca3af);
}

.rejoin-info {
  color: var(--color-text-primary, #111827);
}

.card-actions {
  display: flex;
  gap: 0.75rem;
}

.action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button.secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-primary, #111827);
}

.action-button.secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.action-button.primary {
  background: var(--color-primary, #2A1111);
  border: none;
  color: white;
}

.action-button.primary:hover {
  background: var(--color-primary-dark, #3A1A1A);
}

.action-icon {
  font-size: 1rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .catchup-progress-card {
    --color-bg-primary: #1f2937;
    --color-bg-secondary: #374151;
    --color-bg-tertiary: #4b5563;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-text-tertiary: #6b7280;
    --color-border: #374151;
  }
}
</style>
