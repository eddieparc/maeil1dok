<template>
  <div class="group-member-calendar">
    <!-- 플랜 선택 -->
    <div v-if="plans.length > 1" class="plan-tabs">
      <button
        v-for="plan in plans"
        :key="plan.id"
        @click="handlePlanChange(plan.id)"
        :class="['plan-tab', { active: selectedPlanId === plan.id }]"
      >
        {{ plan.name }}
      </button>
    </div>

    <!-- 달력 헤더 -->
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

    <!-- 로딩 -->
    <SkeletonCalendar v-if="isLoading" />

    <template v-else>
      <!-- 달력 그리드 -->
      <div class="calendar-grid">
        <div v-for="day in weekDays" :key="day" class="weekday-label">{{ day }}</div>

        <div
          v-for="(cell, index) in calendarCells"
          :key="index"
          class="calendar-day"
          :class="{
            'other-month': !cell.isCurrentMonth,
            'today': cell.isToday,
            'has-data': cell.data,
            'all-completed': cell.data && cell.data.completed_count === cell.data.total_members && cell.data.total_members > 0,
            'partial': cell.data && cell.data.completed_count > 0 && cell.data.completed_count < cell.data.total_members,
            'none-completed': cell.data && cell.data.completed_count === 0
          }"
          @click="cell.data ? openDetail(cell) : null"
        >
          <div class="day-number">{{ cell.day }}</div>

          <template v-if="cell.data && cell.isCurrentMonth">
            <!-- 완료 비율 표시 -->
            <div class="completion-indicator">
              <div class="completion-ring">
                <svg viewBox="0 0 36 36" class="ring-svg">
                  <path
                    class="ring-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke-width="3"
                  />
                  <path
                    class="ring-fill"
                    :stroke-dasharray="`${completionPercent(cell.data)} 100`"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke-width="3"
                  />
                </svg>
                <span class="ring-text">{{ cell.data.completed_count }}</span>
              </div>
            </div>

            <!-- 본문 정보 -->
            <div class="schedule-text">
              {{ formatSchedule(cell.data.schedule) }}
            </div>
          </template>
        </div>
      </div>

      <!-- 범례 -->
      <div class="calendar-legend">
        <div class="legend-item">
          <div class="legend-icon all-done"></div>
          <span>전원 완료</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon partial-done"></div>
          <span>일부 완료</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon none-done"></div>
          <span>미완료</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon today-mark"></div>
          <span>오늘</span>
        </div>
      </div>

      <!-- 날짜 상세 모달 -->
      <Teleport to="body">
        <div v-if="selectedDay" class="detail-overlay" @click.self="selectedDay = null">
          <div class="detail-modal">
            <div class="detail-header">
              <h4 class="detail-title">{{ selectedDay.dateLabel }}</h4>
              <button @click="selectedDay = null" class="detail-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div class="detail-schedule">
              {{ formatSchedule(selectedDay.data.schedule) }}
            </div>

            <div class="detail-summary">
              <span class="summary-completed">{{ selectedDay.data.completed_count }}명 완료</span>
              <span class="summary-divider">/</span>
              <span class="summary-total">{{ selectedDay.data.total_members }}명</span>
            </div>

            <div class="detail-members">
              <div
                v-for="member in selectedDay.data.members"
                :key="member.id"
                class="detail-member"
                :class="{ completed: member.is_completed }"
              >
                <div class="member-left">
                  <NuxtImg
                    v-if="member.profile_image"
                    :src="member.profile_image"
                    :alt="member.nickname"
                    class="member-avatar"
                    loading="lazy"
                  />
                  <div v-else class="member-avatar-placeholder">
                    {{ member.nickname?.charAt(0) || '?' }}
                  </div>
                  <span class="member-nickname">{{ member.nickname }}</span>
                </div>
                <span :class="['member-status', member.is_completed ? 'status-done' : 'status-pending']">
                  {{ member.is_completed ? '완료' : '미완료' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useGroupsStore } from '~/stores/groups'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'

interface Plan {
  id: number
  name: string
}

const props = defineProps({
  groupId: {
    type: Number,
    required: true
  },
  plans: {
    type: Array as PropType<Plan[]>,
    default: () => []
  }
})

const groupsStore = useGroupsStore()

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth())
const selectedPlanId = ref<number | null>(null)
const selectedDay = ref<any>(null)

const weekDays = ['일', '월', '화', '수', '목', '금', '토']

const isLoading = computed(() => groupsStore.isMemberCalendarLoading)

const currentMonthLabel = computed(() => {
  return `${currentYear.value}년 ${currentMonth.value + 1}월`
})

// 플랜 초기 선택
onMounted(() => {
  if (props.plans.length > 0) {
    selectedPlanId.value = props.plans[0].id
  }
  loadCalendarData()
})

watch(() => props.plans, (newPlans) => {
  if (newPlans.length > 0 && !selectedPlanId.value) {
    selectedPlanId.value = newPlans[0].id
    loadCalendarData()
  }
}, { immediate: false })

const handlePlanChange = (planId: number) => {
  selectedPlanId.value = planId
  loadCalendarData()
}

const loadCalendarData = () => {
  if (!selectedPlanId.value) return
  groupsStore.fetchGroupMemberProgress(
    props.groupId,
    currentMonth.value + 1,
    currentYear.value,
    selectedPlanId.value
  )
}

const previousMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadCalendarData()
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadCalendarData()
}

const calendarCells = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const prevMonthLastDay = new Date(year, month, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const daysInPrevMonth = prevMonthLastDay.getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells: any[] = []
  const calendarData = groupsStore.memberCalendarData

  // 이전 달
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isToday: false, data: null })
  }

  // 현재 달
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    cells.push({
      day,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      data: calendarData[dateStr] || null,
      dateStr
    })
  }

  // 다음 달 (6줄 고정)
  const remaining = 42 - cells.length
  for (let day = 1; day <= remaining; day++) {
    cells.push({ day, isCurrentMonth: false, isToday: false, data: null })
  }

  return cells
})

const completionPercent = (data: any) => {
  if (!data || data.total_members === 0) return 0
  return Math.round((data.completed_count / data.total_members) * 100)
}

const formatSchedule = (schedule: any) => {
  if (!schedule) return ''
  const { book, start_chapter, end_chapter } = schedule
  if (start_chapter === end_chapter) return `${book} ${start_chapter}장`
  return `${book} ${start_chapter}-${end_chapter}장`
}

const openDetail = (cell: any) => {
  if (!cell.data) return
  const date = new Date(currentYear.value, currentMonth.value, cell.day)
  selectedDay.value = {
    ...cell,
    dateLabel: date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  }
}
</script>

<style scoped>
.group-member-calendar {
  width: 100%;
}

/* 플랜 탭 */
.plan-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.plan-tab {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  border: 1px solid var(--color-slate-200, #E2E8F0);
  background: var(--color-bg-card, white);
  color: var(--color-slate-500, #64748B);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Pretendard', sans-serif;
}

.plan-tab:hover {
  background: var(--color-slate-50, #F8FAFC);
  color: var(--color-slate-700, #334155);
}

.plan-tab.active {
  background: #1E293B;
  border-color: #1E293B;
  color: white;
}

/* 달력 헤더 */
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.25rem;
}

.current-month {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary, #1E293B);
  margin: 0;
  font-family: 'Pretendard', sans-serif;
}

.month-nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-slate-100, #F1F5F9);
  border-radius: 8px;
  color: var(--text-primary, #1E293B);
  cursor: pointer;
  transition: all 0.15s ease;
}

.month-nav-button:hover {
  background: var(--color-slate-200, #E2E8F0);
}

/* 달력 그리드 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
  margin-bottom: 1rem;
}

.weekday-label {
  padding: 0.5rem 0;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #64748B);
}

.calendar-day {
  position: relative;
  padding: 0.375rem;
  border-radius: 8px;
  background: var(--color-bg-card, white);
  border: 1px solid var(--color-slate-100, #F1F5F9);
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  cursor: default;
  transition: all 0.15s ease;
}

.calendar-day.has-data {
  cursor: pointer;
}

.calendar-day.has-data:hover {
  border-color: var(--color-slate-300, #CBD5E1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.calendar-day.other-month {
  background: var(--color-slate-50, #F8FAFC);
  opacity: 0.4;
}

.calendar-day.today {
  border-color: var(--primary-color, #3B82F6);
  border-width: 2px;
}

.calendar-day.all-completed {
  background: #F0FDF4;
  border-color: #DCFCE7;
}

.calendar-day.partial {
  background: #FFFBEB;
  border-color: #FEF3C7;
}

.calendar-day.none-completed {
  background: #FEF2F2;
  border-color: #FECACA;
}

.day-number {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary, #1E293B);
  line-height: 1;
}

.calendar-day.today .day-number {
  color: var(--primary-color, #3B82F6);
  font-weight: 700;
}

/* 완료 비율 링 */
.completion-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.completion-ring {
  position: relative;
  width: 28px;
  height: 28px;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  stroke: var(--color-slate-200, #E2E8F0);
}

.ring-fill {
  stroke: #22C55E;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

.calendar-day.none-completed .ring-fill {
  stroke: #EF4444;
}

.calendar-day.partial .ring-fill {
  stroke: #F59E0B;
}

.ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--text-primary, #1E293B);
}

.schedule-text {
  font-size: 0.5625rem;
  color: var(--text-secondary, #64748B);
  text-align: center;
  line-height: 1.2;
  word-break: keep-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 범례 */
.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--color-slate-50, #F8FAFC);
  border-radius: 8px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #64748B);
}

.legend-icon {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid;
}

.legend-icon.all-done { background: #F0FDF4; border-color: #DCFCE7; }
.legend-icon.partial-done { background: #FFFBEB; border-color: #FEF3C7; }
.legend-icon.none-done { background: #FEF2F2; border-color: #FECACA; }
.legend-icon.today-mark { background: white; border-color: var(--primary-color, #3B82F6); border-width: 2px; }

/* 상세 모달 */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.detail-modal {
  background: var(--color-bg-card, white);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 1.5rem;
  animation: slideUp 0.25s ease;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.detail-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary, #1E293B);
  margin: 0;
}

.detail-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--color-slate-100, #F1F5F9);
  border-radius: 8px;
  color: var(--text-secondary, #64748B);
  cursor: pointer;
}

.detail-schedule {
  font-size: 0.9375rem;
  color: var(--text-secondary, #64748B);
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-slate-50, #F8FAFC);
  border-radius: 8px;
}

.detail-summary {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 1rem;
  font-size: 0.9375rem;
}

.summary-completed {
  color: #16A34A;
  font-weight: 600;
}

.summary-divider {
  color: var(--color-slate-300, #CBD5E1);
}

.summary-total {
  color: var(--text-secondary, #64748B);
}

.detail-members {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-member {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  background: var(--color-slate-50, #F8FAFC);
  border: 1px solid var(--color-slate-100, #F1F5F9);
}

.detail-member.completed {
  background: #F0FDF4;
  border-color: #DCFCE7;
}

.member-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-slate-200, #E2E8F0);
}

.member-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--color-slate-200, #E2E8F0);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-slate-100, #F1F5F9);
  color: var(--color-slate-600, #475569);
  font-weight: 600;
  font-size: 0.8125rem;
}

.member-nickname {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #1E293B);
}

.member-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.status-done {
  background: #DCFCE7;
  color: #16A34A;
}

.status-pending {
  background: #FEE2E2;
  color: #DC2626;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* 반응형 */
@media (max-width: 640px) {
  .calendar-day {
    min-height: 60px;
    padding: 0.25rem;
  }

  .completion-ring {
    width: 24px;
    height: 24px;
  }

  .ring-text { font-size: 0.5625rem; }
  .schedule-text { font-size: 0.5rem; }
  .day-number { font-size: 0.6875rem; }

  .calendar-legend {
    gap: 0.625rem;
  }
}

@media (min-width: 768px) {
  .detail-overlay {
    align-items: center;
  }

  .detail-modal {
    border-radius: 16px;
    max-height: 80vh;
  }
}

/* 다크모드 */
[data-theme="dark"] .calendar-day {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

[data-theme="dark"] .calendar-day.all-completed {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
}

[data-theme="dark"] .calendar-day.partial {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.2);
}

[data-theme="dark"] .calendar-day.none-completed {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

[data-theme="dark"] .plan-tab {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}

[data-theme="dark"] .plan-tab.active {
  background: var(--color-accent-primary);
  color: #ffffff;
  border-color: transparent;
}

[data-theme="dark"] .detail-modal {
  background: var(--color-bg-secondary);
}

[data-theme="dark"] .detail-member {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

[data-theme="dark"] .detail-member.completed {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
}

[data-theme="dark"] .calendar-legend {
  background: var(--color-bg-tertiary);
}
</style>
