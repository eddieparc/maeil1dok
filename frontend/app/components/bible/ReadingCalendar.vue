<template>
  <div class="reading-calendar">
    <!-- 월 네비게이션 -->
    <div class="calendar-header">
      <button class="nav-btn" @click="prevMonth">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18L9 12L15 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span class="current-month">
        {{ currentYear }}년 {{ currentMonth + 1 }}월
      </span>
      <button class="nav-btn" @click="nextMonth">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18L15 12L9 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- 요일 헤더 -->
    <div class="calendar-weekdays">
      <span v-for="day in weekdays" :key="day" :class="{ sunday: day === '일' }">{{ day }}</span>
    </div>

    <!-- 날짜 그리드 -->
    <div class="calendar-grid">
      <div
        v-for="(date, index) in calendarDays"
        :key="index"
        class="calendar-day"
        :class="{
          'other-month': !date.isCurrentMonth,
          'has-reading': date.hasReading,
          'today': date.isToday,
          'sunday': date.dayOfWeek === 0
        }"
      >
        <span class="day-number">{{ date.day }}</span>
        <span v-if="date.hasReading" class="reading-dot"></span>
      </div>
    </div>

    <!-- 범례 -->
    <div class="calendar-legend">
      <span class="legend-item">
        <span class="reading-dot-legend"></span>
        읽음
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { toLocalDateString } from '~/utils/dateFormat';

const props = defineProps<{
  readingDates: string[];
}>();

const today = new Date();
const currentYear = ref(today.getFullYear());
const currentMonth = ref(today.getMonth());

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
};

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
};

// 읽은 날짜 Set
const readingDateSet = computed(() => new Set(props.readingDates));

// 캘린더 날짜 계산
const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: Array<{
    day: number;
    isCurrentMonth: boolean;
    hasReading: boolean;
    isToday: boolean;
    dayOfWeek: number;
  }> = [];

  // 이전 달 날짜
  const prevMonthDays = firstDay.getDay();
  const prevMonthLastDate = new Date(year, month, 0);
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    const day = prevMonthLastDate.getDate() - i;
    const date = new Date(year, month - 1, day);
    days.push({
      day,
      isCurrentMonth: false,
      hasReading: readingDateSet.value.has(formatDate(date)),
      isToday: false,
      dayOfWeek: date.getDay()
    });
  }

  // 현재 달 날짜
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    days.push({
      day,
      isCurrentMonth: true,
      hasReading: readingDateSet.value.has(formatDate(date)),
      isToday,
      dayOfWeek: date.getDay()
    });
  }

  // 다음 달 날짜 (42일 채우기)
  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      day,
      isCurrentMonth: false,
      hasReading: readingDateSet.value.has(formatDate(date)),
      isToday: false,
      dayOfWeek: date.getDay()
    });
  }

  return days;
});

const formatDate = (date: Date): string => toLocalDateString(date);
</script>

<style scoped>
.reading-calendar {
  background: var(--color-bg-card, #fff);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary, #1f2937);
  transition: all 0.2s;
}

.nav-btn:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.current-month {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.5rem;
}

.calendar-weekdays span {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted, #9ca3af);
  padding: 0.25rem 0;
}

.calendar-weekdays span.sunday {
  color: var(--color-error, #ef4444);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: 8px;
  transition: all 0.2s;
}

.calendar-day.other-month {
  opacity: 0.3;
}

.calendar-day.sunday .day-number {
  color: var(--color-error, #ef4444);
}

.calendar-day.today {
  background: var(--primary-light, #eef2ff);
}

.calendar-day.today .day-number {
  color: var(--primary-color, #2A1111);
  font-weight: 600;
}

.calendar-day.has-reading {
  background: var(--color-success-light, #d1fae5);
}

.calendar-day.has-reading.today {
  background: linear-gradient(135deg, var(--primary-light, #eef2ff), var(--color-success-light, #d1fae5));
}

.day-number {
  font-size: 0.8125rem;
  color: var(--text-primary, #1f2937);
}

.reading-dot {
  position: absolute;
  bottom: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-success, #2A1111);
}

.calendar-legend {
  display: flex;
  justify-content: center;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
}

.reading-dot-legend {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success, #2A1111);
}

/* 다크모드 */
:root.dark .reading-calendar {
  background: var(--color-bg-card);
}

:root.dark .nav-btn {
  background: var(--color-bg-secondary);
  color: var(--text-primary);
}

:root.dark .nav-btn:hover {
  background: var(--color-bg-tertiary);
}

:root.dark .calendar-day.today {
  background: var(--primary-dark);
}

:root.dark .calendar-day.has-reading {
  background: rgba(42, 17, 17, 0.2);
}

:root.dark .calendar-legend {
  border-color: var(--color-border);
}
</style>
