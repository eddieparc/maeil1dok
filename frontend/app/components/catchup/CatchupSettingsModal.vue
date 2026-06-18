<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="catchup-overlay" @click="close">
        <div class="catchup-modal" @click.stop>
          <!-- Header -->
          <div class="modal-header">
            <h3>따라잡기 계획 세우기</h3>
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
              <SkeletonList :count="4" variant="schedule" />
            </div>

            <template v-else-if="status">
              <!-- Overdue Summary -->
              <div class="overdue-summary">
                <div class="summary-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="summary-text">
                  <p class="summary-title">밀린 읽기가 <strong>{{ status.overdue_count }}일치</strong> 있어요</p>
                  <p class="summary-sub">총 {{ status.overdue_chapters }}장</p>
                </div>
              </div>

              <!-- Name Input -->
              <section class="form-section">
                <label class="section-label">이름</label>
                <input
                  v-model="settings.name"
                  type="text"
                  class="text-input"
                  placeholder="나의 1월 도전!"
                />
              </section>

              <!-- Range Selection -->
              <section class="form-section">
                <label class="section-label">따라잡을 범위</label>
                <div class="radio-group">
                  <label class="radio-item">
                    <input
                      type="radio"
                      v-model="settings.rangeMode"
                      value="all"
                    />
                    <span class="radio-mark"></span>
                    <span>오늘까지 밀린 것 전부 ({{ status.overdue_count }}일치)</span>
                  </label>
                  <label class="radio-item">
                    <input
                      type="radio"
                      v-model="settings.rangeMode"
                      value="custom"
                    />
                    <span class="radio-mark"></span>
                    <span>기간 직접 선택</span>
                  </label>
                </div>
                <div v-if="settings.rangeMode === 'custom'" class="date-range">
                  <input
                    type="date"
                    v-model="settings.range_start"
                    class="date-input"
                    :min="status.overdue_range?.start"
                    :max="settings.range_end"
                  />
                  <span class="date-separator">~</span>
                  <input
                    type="date"
                    v-model="settings.range_end"
                    class="date-input"
                    :min="settings.range_start"
                    :max="status.overdue_range?.end"
                  />
                </div>
              </section>

              <!-- Strategy Selection -->
              <section class="form-section">
                <label class="section-label">진행 방식</label>
                <div class="strategy-buttons">
                  <button
                    class="strategy-button"
                    :class="{ active: settings.strategy === 'parallel' }"
                    @click="settings.strategy = 'parallel'"
                  >
                    <span class="strategy-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M5 9h14M5 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </span>
                    <span>동시 진행</span>
                  </button>
                  <button
                    class="strategy-button"
                    :class="{ active: settings.strategy === 'sequential' }"
                    @click="settings.strategy = 'sequential'"
                  >
                    <span class="strategy-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M4 12h16M4 12l4-4M4 12l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span>순차 복귀</span>
                  </button>
                </div>
                <p class="strategy-hint">
                  {{ settings.strategy === 'parallel' ? '오늘 읽기와 밀린 읽기를 동시에 진행' : '밀린 것부터 순서대로 읽고 원래 위치로 복귀' }}
                </p>
              </section>

              <!-- Daily Limits -->
              <section class="form-section">
                <label class="section-label">하루 최대 읽기량</label>
                <div class="limit-inputs">
                  <div class="limit-input-group">
                    <input
                      v-model.number="settings.max_daily_readings"
                      type="number"
                      class="number-input"
                      min="1"
                      max="10"
                      placeholder="3"
                    />
                    <span class="limit-label">회</span>
                  </div>
                  <span class="limit-or">또는</span>
                  <div class="limit-input-group">
                    <input
                      v-model.number="settings.max_daily_chapters"
                      type="number"
                      class="number-input"
                      min="1"
                      max="50"
                      placeholder="-"
                    />
                    <span class="limit-label">장</span>
                  </div>
                </div>
              </section>

              <!-- Weekend Multiplier -->
              <section class="form-section">
                <label class="checkbox-toggle">
                  <input
                    type="checkbox"
                    v-model="settings.useWeekendMultiplier"
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">주말에 더 읽기</span>
                </label>
                <div v-if="settings.useWeekendMultiplier" class="multiplier-options">
                  <button
                    v-for="mult in [1.5, 2.0]"
                    :key="mult"
                    class="multiplier-button"
                    :class="{ active: settings.weekend_multiplier === mult }"
                    @click="settings.weekend_multiplier = mult"
                  >
                    {{ mult }}배
                  </button>
                </div>
              </section>

              <!-- Target Date -->
              <section class="form-section">
                <label class="section-label">목표 복귀일</label>
                <p class="suggested-date">
                  추천: {{ formatDate(status.suggested_settings.estimated_rejoin_date) }}
                  <span class="suggested-hint">(하루 {{ status.suggested_settings.max_daily_readings }}회 기준)</span>
                </p>
                <input
                  type="date"
                  v-model="settings.target_rejoin_date"
                  class="date-input full-width"
                  :min="today"
                />
              </section>
            </template>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="button-secondary" @click="handlePreview" :disabled="loading">
              미리보기
            </button>
            <button class="button-primary" @click="handleCreate" :disabled="loading || !isValid">
              계획 시작하기
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue'
import { useCatchup, type CatchupStatus, type CatchupSettings } from '~/composables/useCatchup'

const props = defineProps<{
  isOpen: boolean
  subscriptionId: number
}>()

const emit = defineEmits<{
  close: []
  preview: [settings: CatchupSettings]
  created: [session: any]
}>()

const { status, loading, error, fetchStatus, createSession } = useCatchup()

// Settings form state
const settings = reactive({
  name: '',
  rangeMode: 'all' as 'all' | 'custom',
  range_start: '',
  range_end: '',
  strategy: 'sequential' as 'parallel' | 'sequential',
  max_daily_readings: 3 as number | null,
  max_daily_chapters: null as number | null,
  useWeekendMultiplier: true,
  weekend_multiplier: 1.5,
  target_rejoin_date: '',
})

// Watch for modal open
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await fetchStatus(props.subscriptionId)
    if (status.value?.overdue_range) {
      settings.range_start = status.value.overdue_range.start
      settings.range_end = status.value.overdue_range.end
      settings.target_rejoin_date = status.value.suggested_settings.estimated_rejoin_date
      settings.name = `${new Date().getMonth() + 1}월 따라잡기`
    }
  }
})

// Computed
const today = computed(() => new Date().toISOString().split('T')[0])

const isValid = computed(() => {
  return settings.name.trim() &&
    settings.range_start &&
    settings.range_end &&
    (settings.max_daily_readings || settings.max_daily_chapters)
})

const buildSettings = (): CatchupSettings => {
  return {
    name: settings.name,
    range_start: settings.rangeMode === 'all' ? status.value!.overdue_range!.start : settings.range_start,
    range_end: settings.rangeMode === 'all' ? status.value!.overdue_range!.end : settings.range_end,
    strategy: settings.strategy,
    max_daily_readings: settings.max_daily_readings,
    max_daily_chapters: settings.max_daily_chapters,
    weekend_multiplier: settings.useWeekendMultiplier ? settings.weekend_multiplier : 1.0,
    target_rejoin_date: settings.target_rejoin_date || null,
  }
}

// Methods
const close = () => {
  emit('close')
}

const handlePreview = () => {
  emit('preview', buildSettings())
}

const handleCreate = async () => {
  const session = await createSession(buildSettings(), props.subscriptionId)
  if (session) {
    emit('created', session)
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}
</script>

<style scoped>
.catchup-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 1rem;
}

.catchup-modal {
  width: 100%;
  max-width: 480px;
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

.overdue-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-bg-warning, #fef3c7);
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.summary-icon {
  flex-shrink: 0;
  color: var(--color-warning, #f59e0b);
}

.summary-title {
  font-size: 0.975rem;
  color: var(--color-text-primary, #111827);
  margin: 0 0 0.25rem;
}

.summary-sub {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}

.form-section {
  margin-bottom: 1.5rem;
}

.section-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin-bottom: 0.5rem;
}

.text-input,
.date-input,
.number-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-primary, #111827);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.text-input:focus,
.date-input:focus,
.number-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.9375rem;
  color: var(--color-text-primary, #111827);
}

.radio-item input {
  display: none;
}

.radio-mark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border, #d1d5db);
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
  transition: border-color 0.2s;
}

.radio-item input:checked + .radio-mark {
  border-color: var(--color-primary, #3b82f6);
}

.radio-item input:checked + .radio-mark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: var(--color-primary, #3b82f6);
  border-radius: 50%;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-left: 2rem;
}

.date-separator {
  color: var(--color-text-secondary, #6b7280);
}

.date-range .date-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
}

.strategy-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.strategy-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid var(--color-border, #d1d5db);
  border-radius: 12px;
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.strategy-button.active {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
  color: var(--color-primary, #3b82f6);
}

.strategy-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.strategy-hint {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #6b7280);
  margin-top: 0.5rem;
}

.limit-inputs {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.limit-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.number-input {
  width: 64px;
  text-align: center;
  padding: 0.5rem;
}

.limit-label {
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6b7280);
}

.limit-or {
  font-size: 0.875rem;
  color: var(--color-text-tertiary, #9ca3af);
}

.checkbox-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.checkbox-toggle input {
  display: none;
}

.toggle-slider {
  width: 44px;
  height: 24px;
  background: var(--color-bg-tertiary, #d1d5db);
  border-radius: 12px;
  position: relative;
  transition: background-color 0.2s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.checkbox-toggle input:checked + .toggle-slider {
  background: var(--color-primary, #3b82f6);
}

.checkbox-toggle input:checked + .toggle-slider::after {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 0.9375rem;
  color: var(--color-text-primary, #111827);
}

.multiplier-options {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-left: 3.25rem;
}

.multiplier-button {
  padding: 0.375rem 1rem;
  font-size: 0.875rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  background: var(--color-bg-primary, #ffffff);
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.multiplier-button.active {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
  color: var(--color-primary, #3b82f6);
}

.suggested-date {
  font-size: 0.875rem;
  color: var(--color-primary, #3b82f6);
  margin-bottom: 0.5rem;
}

.suggested-hint {
  color: var(--color-text-secondary, #6b7280);
}

.full-width {
  width: 100%;
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

.button-secondary:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.button-primary {
  background: var(--color-primary, #3b82f6);
  border: none;
  color: white;
}

.button-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.button-primary:disabled,
.button-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .catchup-modal,
.modal-leave-active .catchup-modal {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .catchup-modal,
.modal-leave-to .catchup-modal {
  transform: scale(0.95) translateY(10px);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .catchup-modal {
    --color-bg-primary: #1f2937;
    --color-bg-secondary: #374151;
    --color-bg-tertiary: #4b5563;
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-border: #374151;
  }
}
</style>
