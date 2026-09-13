<template>
  <div class="reading-calendar">
    <div class="calendar-header">
      <button type="button" class="nav-btn" aria-label="이전 달" @click="prevMonth">
        <ChevronLeft :size="18" aria-hidden="true" />
      </button>
      <span class="current-month" aria-live="polite">{{ currentYear }}년 {{ currentMonth + 1 }}월</span>
      <button type="button" class="nav-btn" aria-label="다음 달" :disabled="isCurrentMonth" @click="nextMonth">
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </div>

    <div class="calendar-weekdays" aria-hidden="true">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>
    <div class="calendar-grid">
      <div
        v-for="date in calendarDays"
        :key="date.key"
        class="calendar-day"
        :data-date="date.key"
        :class="{
          'other-month': !date.isCurrentMonth,
          'has-reading': date.hasReading,
          unread: !date.hasReading && !date.isToday && !date.isFuture,
          today: date.isToday,
          future: date.isFuture
        }"
        :aria-hidden="!date.isCurrentMonth || undefined"
        :aria-current="date.isToday ? 'date' : undefined"
        :aria-label="`${date.key}, ${date.isToday ? '오늘, ' : ''}${date.isFuture ? '예정' : date.hasReading ? '읽음' : '미완료'}`"
      >{{ date.isCurrentMonth ? date.day : '' }}</div>
    </div>

    <div class="calendar-legend">
      <span class="legend-item"><span class="legend-swatch legend-read" aria-hidden="true" />읽음</span>
      <span class="legend-item"><span class="legend-swatch legend-unread" aria-hidden="true" />미완료</span>
      <span class="legend-item"><span class="legend-swatch legend-today" aria-hidden="true" />오늘</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { toLocalDateString } from '~/utils/dateFormat';

const props = defineProps<{ readingDates: string[] }>();
const today = new Date();
const todayKey = toLocalDateString(today);
// Always navigate from day 1; retaining today's day would skip February on the 31st.
const displayedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const currentYear = computed(() => displayedMonth.value.getFullYear());
const currentMonth = computed(() => displayedMonth.value.getMonth());
const isCurrentMonth = computed(() => currentYear.value === today.getFullYear() && currentMonth.value === today.getMonth());
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const prevMonth = () => { displayedMonth.value = new Date(currentYear.value, currentMonth.value - 1, 1); };
const nextMonth = () => {
  if (!isCurrentMonth.value) displayedMonth.value = new Date(currentYear.value, currentMonth.value + 1, 1);
};
const readingDateSet = computed(() => new Set(props.readingDates));
const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const offset = new Date(year, month, 1).getDay();
  const length = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length }, (_, index) => {
    const date = new Date(year, month, index - offset + 1);
    const key = toLocalDateString(date);
    const isFuture = key > todayKey;
    const inMonth = date.getMonth() === month;
    return {
      key, day: date.getDate(), isCurrentMonth: inMonth,
      hasReading: inMonth && !isFuture && readingDateSet.value.has(key),
      isToday: inMonth && key === todayKey, isFuture
    };
  });
});
</script>

<style scoped>
.reading-calendar {
  padding: var(--card-padding);
  border: 1px solid var(--color-border-default);
  border-radius: 16px;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
  font-variant-numeric: tabular-nums;
}
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.nav-btn {
  display: grid; place-items: center;
  min-width: var(--hit-min); min-height: var(--hit-min);
  border: 1px solid var(--color-border-default); border-radius: var(--radius-pill);
  background: var(--color-bg-card); color: var(--color-text-secondary); cursor: pointer;
  transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease;
}
.nav-btn:hover:not(:disabled) { background: var(--color-bg-tertiary); }
.nav-btn:active:not(:disabled) { transform: scale(.97); }
.nav-btn:disabled { opacity: .4; cursor: not-allowed; }
.current-month { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
.calendar-weekdays, .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); justify-items: center; gap: 8px 4px; }
.calendar-weekdays { margin-bottom: 8px; color: var(--color-text-tertiary); font-size: 11px; }
.calendar-day {
  display: grid; place-items: center; box-sizing: border-box; width: 32px; height: 32px;
  border: 1.5px solid transparent; border-radius: var(--radius-cell);
  color: var(--color-text-secondary); font-size: 12px; font-weight: 600;
}
.calendar-day.unread, .legend-unread { border: 1.5px dashed var(--color-text-tertiary); }
.calendar-day.has-reading, .legend-read { background: var(--color-accent-primary); color: var(--color-text-inverse); }
.calendar-day.today, .legend-today { border: 1.5px solid var(--color-accent-primary); background: var(--color-accent-bg); color: var(--color-accent-primary); }
.calendar-day.has-reading.today { background: var(--color-accent-primary); color: var(--color-text-inverse); outline: 2px solid var(--color-accent-primary); outline-offset: 2px; }
.calendar-day.future { color: var(--color-text-tertiary); opacity: .55; }
.calendar-day.other-month { visibility: hidden; }
.calendar-legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
.legend-item { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--color-text-secondary); }
.legend-swatch { box-sizing: border-box; width: 12px; height: 12px; border-radius: var(--radius-cell); }
@media (prefers-reduced-motion: reduce) { .nav-btn { transition: none; } .nav-btn:active:not(:disabled) { transform: none; } }
</style>
