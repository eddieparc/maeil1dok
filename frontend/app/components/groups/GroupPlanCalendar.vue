<template>
  <div class="group-plan-calendar">
    <div class="calendar-header">
      <button @click="previousMonth" class="month-nav-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h3 class="current-month">{{ currentMonthLabel }}</h3>
      <button @click="nextMonth" class="month-nav-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>

    <!-- 로딩 상태 -->
    <SkeletonCalendar v-if="isLoading" :weeks="5" />

    <!-- 달력 -->
    <div v-else class="calendar-grid">
      <div v-for="day in weekDays" :key="day" class="weekday-label">
        {{ day }}
      </div>

      <div
        v-for="(date, index) in calendarDates"
        :key="index"
        class="calendar-day"
        :class="{
          'other-month': !date.isCurrentMonth,
          'today': date.isToday,
          'has-schedule': date.schedule,
          'completed': date.schedule?.is_completed,
          'future': date.isFuture
        }"
      >
        <div class="day-number">{{ date.day }}</div>

        <!-- 일정이 있는 경우 -->
        <div v-if="date.schedule && date.isCurrentMonth" class="schedule-info">
          <div
            class="schedule-text"
            :class="{ 'completed': date.schedule.is_completed }"
          >
            {{ formatSchedule(date.schedule) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 범례 -->
    <div class="calendar-legend">
      <div class="legend-item">
        <div class="legend-icon today"></div>
        <span>오늘</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon completed"></div>
        <span>완료</span>
      </div>
      <div class="legend-item">
        <div class="legend-icon future"></div>
        <span>미완료</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGroupsStore } from '~/stores/groups'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'

const props = defineProps({
  planId: {
    type: Number,
    required: true
  }
})

const groupsStore = useGroupsStore()

const currentDate = new Date()
const currentYear = ref(currentDate.getFullYear())
const currentMonth = ref(currentDate.getMonth())
const isLoading = ref(false)

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

const currentMonthLabel = computed(() => {
  return `${currentYear.value}년 ${currentMonth.value + 1}월`
})

// 일정 데이터 가져오기
const loadSchedules = async () => {
  isLoading.value = true
  await groupsStore.fetchGroupPlanSchedule(
    props.planId,
    currentMonth.value + 1, // API는 1-12 월 사용
    currentYear.value
  )
  isLoading.value = false
}

// 달력 날짜 데이터 생성
const calendarDates = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const prevMonthLastDay = new Date(year, month, 0)

  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const daysInPrevMonth = prevMonthLastDay.getDate()

  const dates = []

  // 이전 달 날짜
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    dates.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      schedule: null,
      isToday: false,
      isFuture: false
    })
  }

  // 현재 달 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // 해당 날짜의 일정 찾기
    const schedule = groupsStore.currentPlanSchedules.find(s => s.date === dateStr)

    dates.push({
      day,
      isCurrentMonth: true,
      schedule,
      isToday: date.toDateString() === today.toDateString(),
      isFuture: date > today
    })
  }

  // 다음 달 날짜 (6주 고정)
  const remainingDays = 42 - dates.length
  for (let day = 1; day <= remainingDays; day++) {
    dates.push({
      day,
      isCurrentMonth: false,
      schedule: null,
      isToday: false,
      isFuture: false
    })
  }

  return dates
})

// 일정 포맷 (예: 창세기 1-3장)
const formatSchedule = (schedule: any) => {
  if (!schedule) return ''

  const { book, start_chapter, end_chapter } = schedule

  if (start_chapter === end_chapter) {
    return `${book} ${start_chapter}장`
  } else {
    return `${book} ${start_chapter}-${end_chapter}장`
  }
}

// 이전 달
const previousMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadSchedules()
}

// 다음 달
const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadSchedules()
}

// 초기 로드
onMounted(() => {
  loadSchedules()
})

// planId가 변경되면 다시 로드
watch(() => props.planId, () => {
  loadSchedules()
})
</script>

<style scoped>
.group-plan-calendar {
  width: 100%;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
}

.current-month {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.month-nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.month-nav-button:hover:not(:disabled) {
  background: var(--gray-200);
}

.month-nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 1rem;
}

.weekday-label {
  padding: 0.5rem;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.calendar-day {
  position: relative;
  aspect-ratio: 1;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  background: white;
  border: 1px solid var(--gray-200);
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.25rem;
  min-height: 70px;
}

.calendar-day.other-month {
  background: var(--gray-50);
  opacity: 0.5;
}

.calendar-day.today {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.calendar-day.has-schedule {
  background: #F0F9FF;
}

.calendar-day.completed {
  background: var(--gray-100);
}

.calendar-day.future:not(.has-schedule) {
  background: white;
}

.day-number {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.calendar-day.other-month .day-number {
  color: var(--text-secondary);
}

.calendar-day.today .day-number {
  color: var(--primary-color);
  font-weight: 600;
}

.schedule-info {
  width: 100%;
  text-align: center;
}

.schedule-text {
  font-size: 0.75rem;
  color: var(--color-accent-primary);
  line-height: 1.3;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.schedule-text.completed {
  color: var(--gray-500);
  text-decoration: line-through;
}

.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  padding: 1rem;
  background: var(--gray-50);
  border-radius: var(--radius-md);
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

.legend-icon.today {
  background: var(--primary-light);
  border-color: var(--primary-color);
}

.legend-icon.completed {
  background: var(--gray-100);
  border-color: var(--gray-300);
}

.legend-icon.future {
  background: white;
  border-color: var(--gray-300);
}

/* 반응형 */
@media (max-width: 640px) {
  .calendar-day {
    min-height: 60px;
    padding: 0.25rem;
  }

  .schedule-text {
    font-size: 0.65rem;
  }

  .day-number {
    font-size: 0.75rem;
  }

  .calendar-legend {
    gap: 1rem;
    flex-wrap: wrap;
  }
}
</style>
