<template>
  <div class="today-catchup-list">
    <div class="list-header">
      <span class="header-icon">📚</span>
      <span class="header-label" v-if="!isSequential">따라잡기</span>
      <span class="header-label" v-else>오늘의 읽기</span>
      <span class="header-count">({{ completedCount }}/{{ schedules.length }})</span>
    </div>

    <div class="schedule-items">
      <div
        v-for="schedule in schedules"
        :key="schedule.id"
        class="schedule-item"
        :class="{ completed: schedule.is_completed }"
        @click="handleToggle(schedule)"
      >
        <div class="checkbox" :class="{ checked: schedule.is_completed }">
          <svg v-if="schedule.is_completed" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="item-content">
          <span class="book-name">{{ schedule.book }}</span>
          <span class="chapters">
            {{ schedule.start_chapter }}<template v-if="schedule.start_chapter !== schedule.end_chapter">-{{ schedule.end_chapter }}</template>장
          </span>
        </div>
        <div class="item-links" @click.stop>
          <a v-if="schedule.audio_link" :href="schedule.audio_link" target="_blank" rel="noopener noreferrer" class="link-button">
            🎧
          </a>
          <a v-if="schedule.guide_link" :href="schedule.guide_link" target="_blank" rel="noopener noreferrer" class="link-button">
            📖
          </a>
        </div>
      </div>
    </div>

    <p v-if="schedules.length === 0" class="empty-message">
      오늘 예정된 따라잡기 스케줄이 없습니다.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CatchupSchedule } from '~/composables/useCatchup'

const props = defineProps<{
  schedules: CatchupSchedule[]
  isSequential?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  toggle: [schedule: CatchupSchedule]
}>()

const completedCount = computed(() => props.schedules.filter(s => s.is_completed).length)

const handleToggle = (schedule: CatchupSchedule) => {
  if (props.loading) return
  emit('toggle', schedule)
}
</script>

<style scoped>
.today-catchup-list {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid var(--color-border, #e5e7eb);
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.header-icon {
  font-size: 1rem;
}

.header-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.header-count {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
}

.schedule-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.schedule-item:hover {
  background: var(--color-bg-hover, #f9fafb);
}

.schedule-item.completed {
  opacity: 0.6;
}

.checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.checkbox.checked {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: white;
}

.item-content {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.book-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.schedule-item.completed .book-name {
  text-decoration: line-through;
}

.chapters {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.item-links {
  display: flex;
  gap: 0.5rem;
}

.link-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--color-bg-secondary, #f3f4f6);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.link-button:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.empty-message {
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  padding: 1rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .today-catchup-list {
    --color-bg-primary: #1f2937;
    --color-bg-secondary: #374151;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-border: #374151;
  }
}
</style>
