<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="preview-overlay" @click="close">
        <div class="preview-modal" @click.stop>
          <!-- Header -->
          <div class="modal-header">
            <h3>미리보기</h3>
            <button class="close-button" @click="close" aria-label="닫기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Loading State -->
            <div v-if="loading" class="loading-state-skeleton">
              <SkeletonList :count="5" variant="schedule" />
            </div>

            <template v-else-if="preview">
              <!-- Intro Text -->
              <p class="intro-text">이대로 진행하면...</p>

              <!-- Summary Card -->
              <div class="summary-card">
                <div class="stat-row">
                  <span class="stat-icon">📚</span>
                  <span class="stat-text">총 <strong>{{ preview.summary.total_schedules }}일치</strong> 따라잡기</span>
                </div>
                <div class="stat-row">
                  <span class="stat-icon">📖</span>
                  <span class="stat-text">총 <strong>{{ preview.summary.total_chapters }}장</strong></span>
                </div>
                <div class="stat-row">
                  <span class="stat-icon">📈</span>
                  <span class="stat-text">
                    하루 평균 <strong>{{ preview.summary.daily_average_readings }}회</strong>
                    ({{ preview.summary.daily_average_chapters }}장)
                  </span>
                </div>
                <div class="stat-row">
                  <span class="stat-icon">📅</span>
                  <span class="stat-text">
                    <strong>{{ formatDate(preview.summary.rejoin_date) }}</strong>에 원본 플랜과 합류
                  </span>
                </div>
                <div class="stat-row">
                  <span class="stat-icon">⏱️</span>
                  <span class="stat-text">예상 소요: <strong>{{ preview.summary.estimated_days }}일</strong></span>
                </div>
              </div>

              <!-- Warnings -->
              <div v-if="preview.warnings.length > 0" class="warnings">
                <div v-for="(warning, i) in preview.warnings" :key="i" class="warning-item">
                  <span class="warning-icon">⚠️</span>
                  <span>{{ warning }}</span>
                </div>
              </div>

              <!-- Daily Schedule -->
              <div class="schedule-section">
                <h4 class="section-title">📅 일자별 계획</h4>
                <div class="schedule-list">
                  <div
                    v-for="day in preview.preview_schedules"
                    :key="day.date"
                    class="day-group"
                    :class="{ weekend: day.is_weekend }"
                  >
                    <button class="day-header" @click="toggleDay(day.date)">
                      <span v-if="day.is_weekend" class="weekend-badge">⭐</span>
                      <span class="day-date">{{ formatDayDate(day.date) }}</span>
                      <span class="day-count">{{ day.items.length }}회, {{ day.total_chapters }}장</span>
                      <span class="day-toggle">{{ expandedDays.has(day.date) ? '▼' : '▶' }}</span>
                    </button>
                    <Transition name="expand">
                      <div v-if="expandedDays.has(day.date)" class="day-items">
                        <div v-for="(item, idx) in day.items" :key="idx" class="schedule-item">
                          <span class="item-bullet">•</span>
                          <span class="item-content">
                            {{ item.book }} {{ item.start_chapter }}<template v-if="item.start_chapter !== item.end_chapter">-{{ item.end_chapter }}</template>장
                          </span>
                          <span class="item-original">({{ formatShortDate(item.original_date) }} 밀림)</span>
                        </div>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>

              <!-- Invalid Plan Warning -->
              <div v-if="!preview.valid" class="invalid-warning">
                <p>현재 설정으로는 목표일까지 모두 완료할 수 없습니다.</p>
                <p>목표일을 늦추거나 하루 읽기량을 늘려주세요.</p>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="button-secondary" @click="handleBack">
              ◀ 다시설정
            </button>
            <button
              class="button-primary"
              @click="handleConfirm"
              :disabled="loading || !preview?.valid"
            >
              시작하기 🚀
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import type { CatchupPreviewResult, CatchupSettings } from '~/composables/useCatchup'

const props = defineProps<{
  isOpen: boolean
  preview: CatchupPreviewResult | null
  settings: CatchupSettings
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  back: []
  confirm: [settings: CatchupSettings]
}>()

const expandedDays = ref<Set<string>>(new Set())

// Initialize expanded days when preview loads
watch(() => props.preview, (newPreview) => {
  if (newPreview?.preview_schedules) {
    expandedDays.value.clear()
    // Expand first 3 days by default
    newPreview.preview_schedules.slice(0, 3).forEach(day => {
      expandedDays.value.add(day.date)
    })
  }
}, { immediate: true })

const toggleDay = (date: string) => {
  if (expandedDays.value.has(date)) {
    expandedDays.value.delete(date)
  } else {
    expandedDays.value.add(date)
  }
}

const close = () => {
  emit('close')
}

const handleBack = () => {
  emit('back')
}

const handleConfirm = () => {
  emit('confirm', props.settings)
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

const formatDayDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`
}

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 1rem;
}

.preview-modal {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary, #ffffff);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: var(--color-bg-secondary, #f3f4f6);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.loading-state-skeleton {
  padding: 1rem 0;
}

.intro-text {
  font-size: 1rem;
  color: var(--color-text-secondary, #6b7280);
  margin-bottom: 1rem;
}

.summary-card {
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.stat-row:not(:last-child) {
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.stat-icon {
  font-size: 1.125rem;
  flex-shrink: 0;
}

.stat-text {
  font-size: 0.9375rem;
  color: var(--color-text-primary, #111827);
}

.stat-text strong {
  color: var(--color-primary, #2A1111);
}

.warnings {
  margin-bottom: 1rem;
}

.warning-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-warning, #fef3c7);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--color-warning-text, #92400e);
}

.warning-item:not(:last-child) {
  margin-bottom: 0.5rem;
}

.warning-icon {
  flex-shrink: 0;
}

.schedule-section {
  margin-top: 1.5rem;
}

.section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0 0 0.75rem;
}

.schedule-list {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
}

.day-group {
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.day-group:last-child {
  border-bottom: none;
}

.day-group.weekend {
  background: var(--color-bg-highlight, #fffbeb);
}

.day-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.875rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 0.9375rem;
  color: var(--color-text-primary, #111827);
  transition: background-color 0.2s;
}

.day-header:hover {
  background: var(--color-bg-hover, rgba(0, 0, 0, 0.03));
}

.weekend-badge {
  margin-right: 0.5rem;
}

.day-date {
  font-weight: 500;
  flex: 1;
}

.day-count {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
  margin-right: 0.5rem;
}

.day-toggle {
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 0.75rem;
}

.day-items {
  padding: 0 1rem 0.75rem 2.5rem;
}

.schedule-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.375rem 0;
  font-size: 0.875rem;
}

.item-bullet {
  color: var(--color-text-tertiary, #9ca3af);
}

.item-content {
  color: var(--color-text-primary, #111827);
}

.item-original {
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #9ca3af);
}

.invalid-warning {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--color-bg-error, #fef2f2);
  border-radius: 8px;
  text-align: center;
}

.invalid-warning p {
  font-size: 0.875rem;
  color: var(--color-error, #dc2626);
  margin: 0;
}

.invalid-warning p:not(:last-child) {
  margin-bottom: 0.5rem;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.button-secondary,
.button-primary {
  flex: 1;
  padding: 0.875rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.button-secondary {
  background: var(--color-bg-secondary, #f3f4f6);
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-primary, #111827);
}

.button-secondary:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.button-primary {
  background: var(--color-primary, #2A1111);
  border: none;
  color: white;
}

.button-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #3A1A1A);
}

.button-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .preview-modal,
.modal-leave-active .preview-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .preview-modal,
.modal-leave-to .preview-modal {
  transform: scale(0.95) translateY(10px);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .preview-modal {
    --color-bg-primary: #1f2937;
    --color-bg-secondary: #374151;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-border: #374151;
  }
}
</style>
