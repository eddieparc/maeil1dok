<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h2 class="modal-title">하세나하시조 기록</h2>
            <button class="close-btn" @click="close" aria-label="닫기">
              <XIcon :size="24" />
            </button>
          </div>

          <!-- Stats -->
          <div class="stats-section">
            <div class="stat-item">
              <FlameIcon class="stat-icon" :size="20" />
              <div class="stat-info">
                <span class="stat-value">{{ stats.current_streak }}</span>
                <span class="stat-label">현재 연속</span>
              </div>
            </div>
            <div class="stat-item">
              <TrophyIcon class="stat-icon" :size="20" />
              <div class="stat-info">
                <span class="stat-value">{{ stats.longest_streak }}</span>
                <span class="stat-label">최장 연속</span>
              </div>
            </div>
            <div class="stat-item">
              <CalendarDaysIcon class="stat-icon" :size="20" />
              <div class="stat-info">
                <span class="stat-value">{{ stats.total_completed }}</span>
                <span class="stat-label">총 완료</span>
              </div>
            </div>
          </div>

          <!-- Calendar Navigation -->
          <div class="calendar-nav">
            <button class="nav-btn" @click="prevMonth" aria-label="이전 달">
              <ChevronLeftIcon :size="20" />
            </button>
            <span class="nav-title">{{ calendarTitle }}</span>
            <button class="nav-btn" :disabled="isCurrentMonth" @click="nextMonth" aria-label="다음 달">
              <ChevronRightIcon :size="20" />
            </button>
          </div>

          <!-- Calendar Grid -->
          <div class="calendar-body">
            <template v-if="isLoading">
              <SkeletonCalendar :weeks="5" />
            </template>
            <template v-else>
              <div class="weekdays">
                <span v-for="day in weekdays" :key="day" :class="{ sunday: day === '일' }">{{ day }}</span>
              </div>
              <div class="dates-grid">
                <button
                  v-for="(date, index) in calendarDates"
                  :key="index"
                  class="date-cell"
                  :class="{
                    'other-month': date.otherMonth,
                    'today': date.isToday,
                    'completed': date.completed,
                    'has-entry': date.hasEntry,
                    'selected': date.dateStr === selectedDate,
                    'sunday': date.isSunday,
                    'disabled': date.disabled,
                    'loading': loadingDate === date.dateStr
                  }"
                  :disabled="date.disabled || date.otherMonth || loadingDate !== null"
                  @click="selectDate(date)"
                >
                  <span class="date-number">{{ date.day }}</span>
                  <span v-if="date.completed && !date.otherMonth" class="check-icon">
                    <CheckIcon :size="14" :stroke-width="3" />
                  </span>
                  <span v-else-if="date.hasEntry && !date.otherMonth" class="entry-dot"></span>
                  <span v-if="loadingDate === date.dateStr" class="loading-indicator"></span>
                </button>
              </div>
            </template>
          </div>

          <!-- Legend -->
          <div class="legend">
            <div class="legend-item">
              <span class="legend-dot completed"></span>
              <span>완료</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot today"></span>
              <span>오늘</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot entry"></span>
              <span>본문 있음</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot sunday"></span>
              <span>일요일 (휴무)</span>
            </div>
          </div>

          <!-- Help Text -->
          <p class="help-text">날짜를 탭하면 해당 하세나 본문으로 이동합니다</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlameIcon,
  TrophyIcon,
  XIcon
} from '@lucide/vue'
import { ref, computed, watch } from 'vue'
import { useHasenaStore } from '~/stores/hasena'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'

interface Props {
  isOpen: boolean
  selectedDate: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated'): void
  (e: 'select-date', date: string): void
}>()

const hasenaStore = useHasenaStore()
const loadingDate = ref<string | null>(null)

const today = new Date()
const calendarYear = ref(today.getFullYear())
const calendarMonth = ref(today.getMonth() + 1)

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

const stats = computed(() => hasenaStore.stats)
const calendarTitle = computed(() => `${calendarYear.value}년 ${calendarMonth.value}월`)
const isCurrentMonth = computed(() => 
  calendarYear.value === today.getFullYear() && calendarMonth.value === today.getMonth() + 1
)

const formatApiDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface CalendarDate {
  day: number
  otherMonth: boolean
  isToday: boolean
  completed: boolean
  hasEntry: boolean
  isSunday: boolean
  disabled: boolean
  dateStr: string
  dateObj: Date
}

const calendarDates = computed<CalendarDate[]>(() => {
  const year = calendarYear.value
  const month = calendarMonth.value - 1

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const completedDates = new Set(
    hasenaStore.calendarEntries
      .filter(r => r.is_completed)
      .map(r => r.date)
  )
  const entryDates = new Set(
    hasenaStore.calendarEntries
      .filter(r => r.passage || r.video_id)
      .map(r => r.date)
  )

  const dates: CalendarDate[] = []
  const todayStr = formatApiDate(today)

  // Previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const prevDate = new Date(year, month, -i)
    dates.push({
      day: prevDate.getDate(),
      otherMonth: true,
      isToday: false,
      completed: false,
      hasEntry: false,
      isSunday: prevDate.getDay() === 0,
      disabled: true,
      dateStr: formatApiDate(prevDate),
      dateObj: prevDate
    })
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day)
    const dateStr = formatApiDate(currentDate)
    const isSunday = currentDate.getDay() === 0
    const isFuture = currentDate > today

    dates.push({
      day,
      otherMonth: false,
      isToday: dateStr === todayStr,
      completed: completedDates.has(dateStr),
      hasEntry: entryDates.has(dateStr),
      isSunday,
      disabled: isFuture || !entryDates.has(dateStr),
      dateStr,
      dateObj: currentDate
    })
  }

  // Next month days
  const remaining = 42 - dates.length
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i)
    dates.push({
      day: i,
      otherMonth: true,
      isToday: false,
      completed: false,
      hasEntry: false,
      isSunday: nextDate.getDay() === 0,
      disabled: true,
      dateStr: formatApiDate(nextDate),
      dateObj: nextDate
    })
  }

  return dates
})

const prevMonth = async () => {
  if (calendarMonth.value === 1) {
    calendarMonth.value = 12
    calendarYear.value--
  } else {
    calendarMonth.value--
  }
  await loadCalendarData()
}

const nextMonth = async () => {
  if (isCurrentMonth.value) return
  
  if (calendarMonth.value === 12) {
    calendarMonth.value = 1
    calendarYear.value++
  } else {
    calendarMonth.value++
  }
  await loadCalendarData()
}

const isLoading = ref(true)

const loadCalendarData = async () => {
  isLoading.value = true
  try {
    await hasenaStore.fetchCalendarEntries(calendarYear.value, calendarMonth.value)
  } finally {
    isLoading.value = false
  }
}

const selectDate = async (date: CalendarDate) => {
  if (date.disabled || date.otherMonth || loadingDate.value) return

  loadingDate.value = date.dateStr

  try {
    emit('select-date', date.dateStr)
    close()
  } catch (err) {
    console.error('Failed to select date:', err)
  } finally {
    loadingDate.value = null
  }
}

const close = () => {
  emit('close')
}

// Load data when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    const selected = new Date(`${props.selectedDate}T00:00:00`)
    calendarYear.value = selected.getFullYear()
    calendarMonth.value = selected.getMonth() + 1
    await loadCalendarData()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: var(--color-bg-card);
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-light);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border-light);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 50%;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Stats Section */
.stats-section {
  display: flex;
  justify-content: space-around;
  padding: 1.25rem;
  background: var(--color-bg-secondary, var(--color-bg-hover));
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-icon {
  font-size: 1.25rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.stat-item:nth-child(1) .stat-value {
  color: #f97316;
}

.stat-item:nth-child(2) .stat-value {
  color: #eab308;
}

.stat-item:nth-child(3) .stat-value {
  color: var(--color-accent-primary);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--color-text-tertiary);
}

/* Calendar Navigation */
.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
}

.nav-btn {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 50%;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Calendar Body */
.calendar-body {
  padding: 0 1rem 1rem;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 0.5rem;
}

.weekdays span {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-tertiary);
  padding: 0.5rem 0;
}

.weekdays span.sunday {
  color: #ef4444;
}

.dates-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.date-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.date-cell:not(.disabled):not(.other-month):not(.completed):hover {
  background: var(--color-bg-hover);
}

.date-cell.has-entry:not(.completed) {
  background: var(--color-bg-tertiary);
}

.date-cell.selected {
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}

.date-cell.completed:not(.disabled):hover {
  background: #0d9668;
}

.date-cell:not(.disabled):not(.other-month):active {
  transform: scale(0.95);
}

.date-number {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.date-cell.other-month .date-number {
  color: var(--color-text-tertiary);
  opacity: 0.4;
}

.date-cell.sunday .date-number {
  color: #ef4444;
}

.date-cell.sunday.other-month .date-number {
  color: #ef4444;
  opacity: 0.3;
}

.date-cell.today {
  background: var(--color-accent-primary-light, rgba(99, 102, 241, 0.1));
}

.date-cell.today .date-number {
  font-weight: 700;
  color: var(--color-accent-primary);
}

.date-cell.completed {
  background: #10b981;
}

.date-cell.completed .date-number {
  color: white;
}

.date-cell.completed.today {
  background: #10b981;
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}

.date-cell.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.date-cell.loading {
  cursor: wait;
}

.check-icon {
  position: absolute;
  bottom: 2px;
  right: 2px;
  color: white;
}

.entry-dot {
  position: absolute;
  bottom: 5px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--color-accent-primary);
}

.loading-indicator {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
}

.loading-indicator::after {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border-default);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

[data-theme="dark"] .loading-indicator {
  background: rgba(0, 0, 0, 0.5);
}

/* Legend */
.legend {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border-light);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.legend-dot.completed {
  background: #10b981;
}

.legend-dot.today {
  background: var(--color-accent-primary-light, rgba(99, 102, 241, 0.2));
  border: 1px solid var(--color-accent-primary);
}

.legend-dot.entry {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-accent-primary);
}

.legend-dot.sunday {
  background: #fef2f2;
  border: 1px solid #ef4444;
}

/* Help Text */
.help-text {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  padding: 0.5rem 1rem 1rem;
  margin: 0;
}

/* Animations */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}

/* Responsive */
@media (max-width: 400px) {
  .modal-container {
    max-height: 95vh;
    border-radius: 20px;
  }

  .stats-section {
    padding: 1rem 0.75rem;
  }

  .stat-icon {
    font-size: 1rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .date-cell {
    border-radius: 8px;
  }

  .legend {
    gap: 1rem;
  }
}
</style>
