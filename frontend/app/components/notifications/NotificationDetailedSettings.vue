<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NotificationSettings } from '~/stores/notifications'
import AppSwitch from '~/components/ui/AppSwitch.vue'
import FilterChip from '~/components/ui/FilterChip.vue'
import SegmentedControl from '~/components/ui/SegmentedControl.vue'

// settings는 페이지가 소유한 저장 전 드래프트다. 이 컴포넌트는 필드를 직접
// 갱신하고, 실제 저장/되돌리기는 페이지의 updateSettings 호출이 결정한다.
const props = defineProps<{
  settings: NotificationSettings
  disabled?: boolean
}>()

const WEEKDAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
const IANA_TIMEZONE_SUGGESTIONS = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Australia/Sydney',
] as const

const weekdaySet = computed(() => new Set(props.settings.reminder_weekdays ?? [...ALL_WEEKDAYS]))

function toggleWeekday(day: number) {
  const next = new Set(weekdaySet.value)
  if (next.has(day)) {
    next.delete(day)
  } else {
    next.add(day)
  }
  props.settings.reminder_weekdays = [...next].sort((a, b) => a - b)
}

const quietSameTime = computed(() =>
  props.settings.quiet_hours_enabled === true
  && props.settings.quiet_hours_start !== undefined
  && props.settings.quiet_hours_start.padEnd(8, ':00')
    === props.settings.quiet_hours_end?.padEnd(8, ':00'))

const PAUSE_MODES = ['resume', 'tomorrow', 'week', 'custom'] as const
type PauseMode = typeof PAUSE_MODES[number]

const pauseOptions: Array<{ value: PauseMode; label: string }> = [
  { value: 'resume', label: '중지 안 함' },
  { value: 'tomorrow', label: '내일까지' },
  { value: 'week', label: '일주일' },
  { value: 'custom', label: '직접 선택' },
]

// 사용자가 고른 선택지를 기억한다. paused_until 값만으로는 '내일까지'와
// '직접 선택'을 구분할 수 없기 때문이다.
const pauseChoice = ref<PauseMode | null>(null)
const pauseMode = computed<PauseMode>(() =>
  pauseChoice.value ?? (props.settings.paused_until ? 'custom' : 'resume'))

function isPauseMode(value: string | number): value is PauseMode {
  return PAUSE_MODES.some(mode => mode === value)
}

function setPauseMode(value: string | number) {
  if (!isPauseMode(value)) return
  pauseChoice.value = value
  const dayMs = 24 * 60 * 60 * 1000
  switch (value) {
    case 'resume':
      props.settings.paused_until = null
      break
    case 'tomorrow':
      props.settings.paused_until = new Date(Date.now() + dayMs).toISOString()
      break
    case 'week':
      props.settings.paused_until = new Date(Date.now() + 7 * dayMs).toISOString()
      break
    case 'custom':
      if (!props.settings.paused_until) {
        props.settings.paused_until = new Date(Date.now() + dayMs).toISOString()
      }
      break
    default: {
      const unreachable: never = value
      throw new Error(`unknown pause mode: ${unreachable}`)
    }
  }
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const pausedLocal = computed({
  get: () => isoToLocalInput(props.settings.paused_until),
  set: (value: string) => {
    if (!value) {
      props.settings.paused_until = null
      return
    }
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      props.settings.paused_until = date.toISOString()
    }
  },
})

const dailyLimit = computed({
  get: () => props.settings.daily_push_limit ?? 3,
  set: (value: number | string) => {
    const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
    const safe = Number.isNaN(parsed) ? 1 : parsed
    props.settings.daily_push_limit = Math.min(10, Math.max(1, safe))
  },
})
</script>

<template>
  <section class="detailed-settings" aria-label="세부 알림 설정">
    <div class="setting-row">
      <AppSwitch
        :model-value="settings.streak_reminders_enabled === true"
        label="연속 기록 알림"
        description="이어 온 읽기 기록이 끊기기 전에 알려드려요."
        :disabled="disabled"
        data-testid="streak-reminders-enabled"
        @update:model-value="settings.streak_reminders_enabled = $event"
      />
    </div>

    <label class="setting-row compact">
      <span>
        <strong>연속 기록 알림 시간</strong>
      </span>
      <input
        v-model="settings.streak_reminder_time"
        type="time"
        data-testid="streak-reminder-time"
        :disabled="disabled || settings.streak_reminders_enabled !== true"
      >
    </label>

    <fieldset class="setting-group">
      <legend>알림 요일</legend>
      <p class="setting-help">선택한 요일에만 리마인더를 보내요. 모두 끄면 예약 알림이 없어요.</p>
      <div class="weekday-chips" data-testid="reminder-weekdays">
        <FilterChip
          v-for="(name, day) in WEEKDAY_NAMES"
          :key="day"
          :label="name"
          :active="weekdaySet.has(day)"
          :disabled="disabled"
          @click="toggleWeekday(day)"
        />
      </div>
    </fieldset>

    <label class="setting-row compact timezone-row">
      <span>
        <strong>시간대</strong>
        <small>알림 시간을 계산할 기준 시간대예요. IANA 이름으로 입력해 주세요.</small>
      </span>
      <input
        v-model="settings.timezone"
        type="text"
        list="notification-timezone-suggestions"
        placeholder="Asia/Seoul"
        autocomplete="off"
        data-testid="notification-timezone"
        :disabled="disabled"
      >
    </label>
    <datalist id="notification-timezone-suggestions">
      <option v-for="zone in IANA_TIMEZONE_SUGGESTIONS" :key="zone" :value="zone" />
    </datalist>

    <div class="setting-row">
      <AppSwitch
        :model-value="settings.quiet_hours_enabled === true"
        label="방해 금지 시간"
        description="설정한 시간 동안 모든 알림을 보내지 않아요."
        :disabled="disabled"
        data-testid="quiet-hours-enabled"
        @update:model-value="settings.quiet_hours_enabled = $event"
      />
    </div>

    <fieldset class="setting-group">
      <legend>방해 금지 시간대</legend>
      <p class="setting-help" data-testid="quiet-hours-note">
        방해 금지 시간에는 연속 기록 알림도 울리지 않아요.
      </p>
      <div class="time-range">
        <label class="time-field">
          <span>시작</span>
          <input
            v-model="settings.quiet_hours_start"
            type="time"
            data-testid="quiet-hours-start"
            :disabled="disabled || settings.quiet_hours_enabled !== true"
          >
        </label>
        <span class="time-range-separator" aria-hidden="true">~</span>
        <label class="time-field">
          <span>종료</span>
          <input
            v-model="settings.quiet_hours_end"
            type="time"
            data-testid="quiet-hours-end"
            :disabled="disabled || settings.quiet_hours_enabled !== true"
          >
        </label>
      </div>
      <p v-if="quietSameTime" class="setting-warning" data-testid="quiet-hours-same-time" role="alert">
        시작과 종료 시각이 같으면 저장할 수 없어요.
      </p>
    </fieldset>

    <fieldset class="setting-group">
      <legend>알림 일시 중지</legend>
      <SegmentedControl
        :model-value="pauseMode"
        :options="pauseOptions"
        :disabled="disabled"
        data-testid="pause-mode"
        @update:model-value="setPauseMode"
      />
      <label v-if="pauseMode === 'custom'" class="pause-custom">
        <span>다시 받을 시각</span>
        <input
          v-model="pausedLocal"
          type="datetime-local"
          data-testid="pause-custom-time"
          :disabled="disabled"
        >
      </label>
    </fieldset>

    <label class="setting-row compact">
      <span>
        <strong>하루 알림 상한</strong>
        <small>하루에 받는 알림 수를 1~10개로 제한해요.</small>
      </span>
      <input
        v-model.number="dailyLimit"
        type="number"
        min="1"
        max="10"
        data-testid="daily-push-limit"
        :disabled="disabled"
      >
    </label>
  </section>
</template>

<style scoped>
.detailed-settings {
  display: contents;
}

.setting-row {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  border-bottom: 1px solid var(--color-border-light);
  word-break: keep-all;
  overflow-wrap: break-word;
}

.setting-row.compact {
  min-height: 56px;
}

.timezone-row {
  flex-direction: column;
  align-items: stretch;
}

.timezone-row input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.setting-row span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--spacing-1);
}

.setting-row strong,
.setting-group legend {
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  font-weight: 600;
}

.setting-row small,
.setting-help {
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.setting-row :deep(.app-switch) {
  flex: 1;
  min-height: 0;
}

.setting-group {
  margin: 0;
  padding: var(--spacing-4);
  border: 0;
  border-bottom: 1px solid var(--color-border-light);
  min-inline-size: 0;
}

.setting-group legend {
  padding: 0;
  margin-bottom: var(--spacing-1);
}

.setting-help {
  margin: 0 0 var(--spacing-3);
}

.setting-warning {
  margin: var(--spacing-2) 0 0;
  color: var(--color-error);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.weekday-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.time-range {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.time-field {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
}

.time-range-separator {
  color: var(--color-text-tertiary);
}

.pause-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  margin-top: var(--spacing-3);
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
}

input[type="time"],
input[type="text"],
input[type="number"],
input[type="datetime-local"] {
  min-height: 40px;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  padding: 0 var(--spacing-3);
  font: inherit;
}

input[type="number"] {
  width: 72px;
}

input:disabled {
  opacity: 0.5;
}
</style>
