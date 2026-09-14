<script setup lang="ts">
import { computed } from 'vue';
import { Check, Minus } from '@lucide/vue';
import StatusBadge from '~/components/ui/StatusBadge.vue';
import { DAY_NAMES, getBookCode } from '~/constants/bible';
import { getTodayString } from '~/utils/dateFormat';
import type { Schedule, ReadingStatus } from '~/types/plan';

const props = defineProps<{
  date: string;
  schedules: Schedule[];
  currentBook?: string;
  currentChapter?: number;
  isModal?: boolean;
  isBulkEditMode?: boolean;
  isInSelectedRange?: boolean;
  isMobile?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  groupClick: [schedules: Schedule[]];
  groupCheckbox: [schedules: Schedule[]];
  itemClick: [schedule: Schedule];
  itemCheckbox: [schedule: Schedule];
}>();
const allCompleted = computed(() => props.schedules.length > 0 && props.schedules.every(schedule => schedule.is_completed));
const mixed = computed(() => !allCompleted.value && props.schedules.some(schedule => schedule.is_completed));
const readingStatus = computed((): ReadingStatus => status(allCompleted.value));
function status(completed: boolean): ReadingStatus {
  if (completed) return 'completed';
  const today = getTodayString();
  return props.date === today ? 'current' : props.date < today ? 'not_completed' : 'upcoming';
}
const formattedDate = computed(() => {
  const year = Number(props.date.slice(0, 4));
  const month = Number(props.date.slice(5, 7));
  const day = Number(props.date.slice(8, 10));
  return `${month}/${day}(${DAY_NAMES[new Date(year, month - 1, day).getDay()]})`;
});
function title(schedule: Schedule) {
  return `${schedule.book} ${schedule.start_chapter}${schedule.start_chapter === schedule.end_chapter ? '' : `–${schedule.end_chapter}`}${schedule.book === '시편' ? '편' : '장'}`;
}
function isCurrentLocation(schedule: Schedule) {
  return props.isModal && props.currentBook && props.currentChapter
    && (schedule.book === props.currentBook || getBookCode(schedule.book) === props.currentBook)
    && props.currentChapter >= schedule.start_chapter && props.currentChapter <= schedule.end_chapter;
}
</script>

<template>
  <article :data-date="date" class="schedule-item" :class="[readingStatus, { 'selected-range': isInSelectedRange, 'current-location': schedules.some(isCurrentLocation) }]">
    <div class="schedule-group">
      <button type="button" class="checkbox" role="checkbox" :data-group-checkbox="date" :aria-checked="mixed ? 'mixed' : allCompleted"
        :aria-label="`${formattedDate} ${isBulkEditMode ? '범위 선택' : '읽음 표시'}`" :disabled="disabled" @click="emit('groupCheckbox', schedules)">
        <span class="check-circle" :class="{ checked: allCompleted }"><Check v-if="allCompleted" :size="16" aria-hidden="true" /><Minus v-else-if="mixed" :size="16" aria-hidden="true" /></span>
      </button>
      <div class="schedule-info">
        <button v-if="schedules.length > 1" type="button" class="group-date" :disabled="disabled" @click="emit('groupClick', schedules)">{{ formattedDate }}</button>
        <span v-else class="schedule-date">{{ formattedDate }}</span>
        <div v-for="schedule in schedules" :key="schedule.id" class="schedule-reading-item" :class="{ 'current-location': isCurrentLocation(schedule) }">
          <button v-if="schedules.length > 1" type="button" class="checkbox" role="checkbox" :data-checkbox="schedule.id"
            :aria-checked="schedule.is_completed" :aria-label="`${title(schedule)} ${isBulkEditMode ? '범위 선택' : '읽음 표시'}`" :disabled="disabled" @click="emit('itemCheckbox', schedule)">
            <span class="check-circle" :class="{ checked: schedule.is_completed }"><Check v-if="schedule.is_completed" :size="16" aria-hidden="true" /></span>
          </button>
          <button type="button" class="schedule-reading" :data-schedule="schedule.id" :disabled="disabled" @click="emit('itemClick', schedule)">
            <span v-if="isCurrentLocation(schedule)" class="current-location-badge">현재 위치</span><span>{{ title(schedule) }}</span>
          </button>
          <StatusBadge v-if="schedules.length > 1" :status="status(schedule.is_completed)" />
        </div>
      </div>
      <StatusBadge v-if="schedules.length === 1" :status="readingStatus" />
    </div>
  </article>
</template>

<style scoped>
.schedule-item { padding: 12px 14px; border: 1px solid var(--color-border-default); border-radius: 16px; background: var(--color-bg-card); }
.schedule-group { display: flex; align-items: center; gap: 8px; }
.schedule-info { flex: 1; min-width: 0; }
.schedule-reading-item { display: flex; align-items: center; gap: 4px; }
.schedule-reading { display: flex; flex: 1; flex-wrap: wrap; align-items: center; gap: 6px; text-align: left; font-size: 15px; font-weight: 600; line-height: 1.5; }
.schedule-date, .group-date { color: var(--color-text-tertiary); font-size: 12px; }
.group-date { width: 100%; text-align: left; }
button { min-height: var(--hit-min); min-width: var(--hit-min); padding: 0; border: 0; border-radius: var(--radius-control); background: transparent; color: inherit; cursor: pointer; transition: background-color .15s, transform .15s; }
button:hover:not(:disabled) { background: var(--color-accent-bg); }
button:active:not(:disabled) { transform: scale(.97); }
button:disabled { cursor: not-allowed; opacity: .6; }
.checkbox { flex-shrink: 0; display: grid; place-items: center; width: var(--hit-min); height: var(--hit-min); }
.check-circle { display: grid; place-items: center; width: 26px; height: 26px; border: 1.5px solid var(--color-border-default); border-radius: var(--radius-pill); color: var(--color-accent-primary); }
.check-circle.checked { background: var(--color-accent-primary); border-color: var(--color-accent-primary); color: var(--color-text-inverse); }
.not_completed .check-circle:not(.checked) { border-style: dashed; border-color: var(--color-error); }
.current, .current-location { border-color: var(--color-accent-primary); }
.current .schedule-date, .current .group-date { color: var(--color-accent-primary); }
.upcoming { opacity: .85; }
.selected-range { background: var(--color-accent-bg); border-color: var(--color-accent-primary); }
.current-location-badge { font-size: 11px; color: var(--color-accent-primary); }
@media (max-width: 380px) { .schedule-reading-item { flex-wrap: wrap; } }
@media (prefers-reduced-motion: reduce) { button { transition: none; } button:active:not(:disabled) { transform: none; } }
</style>
