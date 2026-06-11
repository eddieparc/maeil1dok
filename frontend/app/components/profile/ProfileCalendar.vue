<template>
  <div class="profile-calendar fade-in">
    <div class="calendar-header">
      <button @click="previousMonth" class="month-nav-button">
        <ChevronLeftIcon :size="20" />
      </button>
      <h3 class="current-month">{{ currentMonthLabel }}</h3>
      <button @click="nextMonth" class="month-nav-button" :disabled="isCurrentMonth">
        <ChevronRightIcon :size="20" />
      </button>
    </div>

    <!-- 플랜 범례 -->
    <div v-if="plans.length > 0" class="plan-legend">
      <div v-for="plan in plans" :key="plan.id" class="legend-plan-item">
        <span class="legend-dot" :style="{ backgroundColor: plan.color }"></span>
        <span class="legend-name">{{ plan.name }}</span>
      </div>
    </div>

    <div class="calendar-grid">
      <div v-for="day in weekDays" :key="day" class="weekday-label">
        {{ day }}
      </div>

      <CalendarDayCell
        v-for="(date, index) in calendarDates"
        :key="index"
        :day="date.day"
        :date-str="date.dateStr"
        :is-current-month="date.isCurrentMonth"
        :is-today="date.isToday"
        :is-future="date.isFuture"
        :schedules="date.schedules"
        :display-mode="hasMultiplePlans ? 'text' : 'simple'"
        :max-items="2"
        @click="handleDayClick"
      />
    </div>

    <div class="calendar-legend">
      <div class="legend-item">
        <div class="legend-icon completed"></div>
        <span>완료</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon today"></div>
        <span>오늘</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon future"></div>
        <span>미래</span>
      </div>
    </div>

    <!-- 날짜 상세 모달 -->
    <ScheduleDetailModal
      :is-open="showModal"
      :date="selectedDate"
      :schedules="selectedSchedules"
      :profile-user-id="userId"
      @close="closeModal"
      @navigate="handleNavigate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CalendarDayCell from '~/components/calendar/CalendarDayCell.vue'
import ScheduleDetailModal from '~/components/calendar/ScheduleDetailModal.vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import type { ScheduleDisplay } from '~/components/calendar/CalendarDayCell.vue'
import type { ScheduleDetail } from '~/components/calendar/ScheduleDetailModal.vue'

interface CalendarDataItem {
  date: string
  is_completed: boolean
  book: string
  chapters: string
  start_chapter?: number
  end_chapter?: number
  plan_id?: number
  plan_name?: string
  color?: string
  schedule_id?: number
  schedule_text?: string
}

interface PlanInfo {
  id: number
  name: string
  color: string
}

const props = defineProps<{
  calendarData: CalendarDataItem[]
  plans?: PlanInfo[]
  userId?: number  // 프로필 사용자 ID (뒤로가기용)
}>()

const emit = defineEmits<{
  (e: 'month-change', year: number, month: number): void
  (e: 'navigate-to-date', schedule: ScheduleDetail): void
}>()

const currentDate = new Date()
const currentYear = ref(currentDate.getFullYear())
const currentMonth = ref(currentDate.getMonth())

// 모달 상태
const showModal = ref(false)
const selectedDate = ref<{ dateStr: string; day: number } | null>(null)
const selectedSchedules = ref<ScheduleDetail[]>([])

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

const hasMultiplePlans = computed(() => {
  return (props.plans?.length ?? 0) > 0 || props.calendarData.some(d => d.plan_id)
})

const plans = computed(() => props.plans ?? [])

const currentMonthLabel = computed(() => {
  return `${currentYear.value}년 ${currentMonth.value + 1}월`
})

const isCurrentMonth = computed(() => {
  return currentYear.value === currentDate.getFullYear() &&
         currentMonth.value === currentDate.getMonth()
})

// O(1) 조회를 위한 날짜별 데이터 맵
const calendarDataMap = computed(() => {
  const map = new Map<string, CalendarDataItem[]>()
  for (const item of props.calendarData) {
    const dateStr = typeof item.date === 'string' ? item.date : item.date
    const existing = map.get(dateStr) || []
    existing.push(item)
    map.set(dateStr, existing)
  }
  return map
})

const calendarDates = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const prevMonthLastDay = new Date(year, month, 0)

  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const daysInPrevMonth = prevMonthLastDay.getDate()

  const dates: Array<{
    day: number
    dateStr: string
    isCurrentMonth: boolean
    isToday: boolean
    isFuture: boolean
    schedules: ScheduleDisplay[]
  }> = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Previous month days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    dates.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: false,
      isFuture: false,
      schedules: []
    })
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // O(1) 조회
    const daySchedules = calendarDataMap.value.get(dateStr) || []
    const schedules: ScheduleDisplay[] = daySchedules.map(item => ({
      plan_id: item.plan_id,
      plan_name: item.plan_name,
      color: item.color || '#3B82F6',
      book: item.book,
      chapters: item.chapters,
      schedule_text: item.schedule_text,
      full_text: `${item.book} ${item.chapters}`,
      is_completed: item.is_completed,
      schedule_id: item.schedule_id
    }))

    dates.push({
      day,
      dateStr,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      isFuture: date > today,
      schedules
    })
  }

  // Next month days
  const remainingDays = 42 - dates.length
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    dates.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: false,
      isFuture: false,
      schedules: []
    })
  }

  return dates
})

const handleDayClick = (payload: { dateStr: string; day: number; schedules: ScheduleDisplay[] }) => {
  if (payload.schedules.length === 0) return

  selectedDate.value = { dateStr: payload.dateStr, day: payload.day }
  selectedSchedules.value = payload.schedules.map(s => ({
    plan_id: s.plan_id || 0,
    plan_name: s.plan_name || '',
    color: s.color,
    book: s.book || '',
    chapters: s.chapters,
    is_completed: s.is_completed,
    schedule_id: s.schedule_id,
    schedule_text: s.schedule_text
  }))
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedDate.value = null
  selectedSchedules.value = []
}

const handleNavigate = (schedule: ScheduleDetail) => {
  emit('navigate-to-date', schedule)
}

const previousMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  emit('month-change', currentYear.value, currentMonth.value + 1)
}

const nextMonth = () => {
  if (isCurrentMonth.value) return

  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  emit('month-change', currentYear.value, currentMonth.value + 1)
}
</script>

<style scoped>
.profile-calendar {
  padding: 1rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.month-nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid var(--gray-300);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

:root.dark .month-nav-button {
  border-color: var(--color-border);
  color: var(--text-primary);
}

.month-nav-button:hover:not(:disabled) {
  background: var(--gray-100);
  border-color: var(--primary-color);
}

:root.dark .month-nav-button:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.month-nav-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.current-month {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* 플랜 범례 */
.plan-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.5rem 0;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--gray-200);
}

:root.dark .plan-legend {
  border-color: var(--color-border);
}

.legend-plan-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.375rem;
}

.weekday-label {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 0.5rem 0;
}

.calendar-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--gray-200);
}

:root.dark .calendar-legend {
  border-color: var(--color-border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.legend-icon {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--gray-300);
}

:root.dark .legend-icon {
  border-color: var(--color-border);
}

.legend-icon.completed {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.legend-icon.today {
  border-color: var(--primary-color);
  border-width: 2px;
}

.legend-icon.future {
  background: var(--gray-50);
}

:root.dark .legend-icon.future {
  background: var(--color-bg-tertiary);
}

@media (max-width: 640px) {
  .profile-calendar {
    padding: 0.75rem;
  }

  .calendar-grid {
    gap: 0.25rem;
  }

  .plan-legend {
    gap: 0.5rem;
    padding: 0.375rem 0;
    margin-bottom: 0.5rem;
  }

  .legend-name {
    font-size: 0.6875rem;
  }

  .calendar-legend {
    gap: 1rem;
    font-size: 0.8125rem;
  }
}
</style>
