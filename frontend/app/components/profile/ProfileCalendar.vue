<template>
  <div class="profile-calendar fade-in">
    <div class="calendar-header">
      <button type="button" @click="previousMonth" class="month-nav-button" aria-label="이전 달">
        <ChevronLeftIcon :size="20" />
      </button>
      <h3 class="current-month">{{ currentMonthLabel }}</h3>
      <button type="button" @click="nextMonth" class="month-nav-button" :disabled="isCurrentMonth" aria-label="다음 달">
        <ChevronRightIcon :size="20" />
      </button>
    </div>

    <!-- 플랜 범례 -->
    <div v-if="plans.length > 0" class="plan-legend">
      <div v-for="plan in plans" :key="plan.id" class="legend-plan-item">
        <span class="legend-dot" aria-hidden="true"></span>
        <span class="legend-name">{{ plan.name }}</span>
      </div>
    </div>

    <div class="calendar-grid">
      <div v-for="day in weekDays" :key="day" class="weekday-label">
        {{ day }}
      </div>

      <button
        v-for="date in calendarDates"
        :key="date.dateStr"
        type="button"
        class="calendar-day-button"
        :class="{ 'other-month': !date.isCurrentMonth }"
        :disabled="!date.isCurrentMonth || date.schedules.length === 0"
        :aria-label="`${date.dateStr}, ${dayStateLabel(date)}${date.schedules.length ? `, 일정 ${date.schedules.length}개` : ''}`"
        :aria-current="date.isToday ? 'date' : undefined"
        @click="handleDayClick(date)"
      >
        <span class="calendar-day-cell" :class="dayState(date)">{{ date.day }}</span>
      </button>
    </div>

    <div class="calendar-legend">
      <div class="legend-item">
        <div class="legend-icon completed"></div>
        <span>읽음</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon today"></div>
        <span>오늘</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon missed"></div>
        <span>미완료</span>
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
import { ref, computed } from 'vue'
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
      color: item.color || 'var(--color-accent-primary)',
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

type CalendarDate = typeof calendarDates.value[number]

const dayState = (date: CalendarDate) => {
  if (!date.isCurrentMonth) return 'outside'
  if (date.schedules.length > 0 && date.schedules.every(schedule => schedule.is_completed)) return 'completed'
  if (date.isToday) return 'today'
  if (date.isFuture) return 'future'
  return 'missed'
}

const dayStateLabel = (date: CalendarDate) => ({
  outside: '다른 달',
  completed: '읽음',
  today: '오늘',
  future: '미래',
  missed: '미완료',
})[dayState(date)]

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
.profile-calendar { padding: var(--card-padding); letter-spacing: var(--tracking-body); }
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.month-nav-button {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--hit-min);
  height: var(--hit-min);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}
.month-nav-button::before { content: ''; position: absolute; inset: 8px; border: 1px solid var(--color-border-default); border-radius: var(--radius-control); }
.month-nav-button:disabled { opacity: 0.3; cursor: not-allowed; }
.current-month { margin: 0; font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
.plan-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; padding-bottom: 12px; }
.legend-plan-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-accent-primary); flex-shrink: 0; }
.legend-name { font-size: 11px; color: var(--color-text-secondary); }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px 4px; margin-inline: -12px; }
.weekday-label { padding-block: 6px; text-align: center; font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); }
.calendar-day-button {
  display: grid;
  place-items: center;
  justify-self: center;
  width: var(--hit-min);
  height: var(--hit-min);
  padding: 0;
  border: none;
  border-radius: var(--radius-cell);
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.calendar-day-button:disabled { cursor: default; }
.calendar-day-cell { display: grid; place-items: center; box-sizing: border-box; width: 32px; height: 32px; border-radius: var(--radius-cell); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.calendar-day-cell.completed,
.legend-icon.completed { background: var(--color-schedule-completed-bg); color: var(--color-schedule-completed-text); }
.calendar-day-cell.today,
.legend-icon.today { background: var(--color-schedule-current-bg); border: 1.5px solid var(--color-schedule-current-border); color: var(--color-schedule-current-text); }
.calendar-day-cell.missed,
.legend-icon.missed { border: 1.5px dashed var(--color-schedule-missed-border); color: var(--color-text-tertiary); }
.calendar-day-cell.future,
.legend-icon.future { background: var(--color-schedule-upcoming-bg); color: var(--color-schedule-upcoming-text); }
.other-month { visibility: hidden; }
.calendar-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 16px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-secondary); }
.legend-icon { box-sizing: border-box; width: 12px; height: 12px; border-radius: var(--radius-cell); }
button { transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
button:hover:not(:disabled) { background: var(--color-bg-hover); }
button:active:not(:disabled) { transform: scale(0.97); }
button:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: -3px; }
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
  button:active:not(:disabled) { transform: none; }
}
</style>
