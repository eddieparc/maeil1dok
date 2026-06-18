<template>
  <div class="multi-plan-calendar">
    <!-- 헤더 -->
    <CalendarHeader
      :year="currentYear"
      :month="currentMonth"
      :is-loading="isLoading"
      :readonly="readonly"
      @prev="handlePrevMonth"
      @next="handleNextMonth"
      @today="handleGoToToday"
      @go-incomplete="showIncompleteModal = true"
      @settings="showSettingsModal = true"
    />

    <!-- 플랜 토글 패널 -->
    <PlanTogglePanel
      :settings="allActivePlans"
      :readonly="readonly"
      @toggle="handleToggleVisibility"
    />

    <!-- 로딩 오버레이 대체 -->

    <!-- 달력 그리드 -->
    <div class="calendar-container">
      <template v-if="isLoading">
        <SkeletonStats v-if="allActivePlans.length > 0" :count="3" class="mb-4" />
        <SkeletonCalendar :weeks="5" />
      </template>
      <template v-else>
        <div class="calendar-grid">
          <div v-for="day in weekDays" :key="day" class="weekday-label">
            {{ day }}
          </div>

          <MultiPlanCalendarDay
            v-for="(date, index) in calendarDates"
            :key="index"
            :date="date"
            :plans="getDisplayForDate(date.dateStr)"
            :is-today="date.isToday"
            :is-current-month="date.isCurrentMonth"
            @click="handleDayClick(date)"
          />
        </div>

        <!-- 범례 -->
        <CalendarLegend :visible-plans="visiblePlans" />
      </template>
    </div>

    <!-- 설정 모달 (readonly가 아닐 때만) -->
    <PlanSettingsModal
      v-if="showSettingsModal && !readonly"
      :settings="allActivePlans"
      @close="showSettingsModal = false"
      @update-color="handleUpdateColor"
      @reorder="handleReorder"
    />

    <!-- 미완료 위치 선택 모달 (readonly가 아닐 때만) -->
    <LastIncompleteModal
      v-if="showIncompleteModal && !readonly"
      :positions="lastIncompletePositions"
      :is-loading="isLoadingPositions"
      @close="showIncompleteModal = false"
      @select="handleSelectIncomplete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import SkeletonCalendar from '~/components/ui/skeleton/SkeletonCalendar.vue'
import SkeletonStats from '~/components/ui/skeleton/SkeletonStats.vue'
import { useCalendarDisplayStore, type PlanDisplaySetting, type CalendarDayData } from '~/stores/calendarDisplay'
import { useApi } from '~/composables/useApi'
import CalendarHeader from './CalendarHeader.vue'
import PlanTogglePanel from './PlanTogglePanel.vue'
import MultiPlanCalendarDay from './MultiPlanCalendarDay.vue'
import CalendarLegend from './CalendarLegend.vue'
import PlanSettingsModal from './PlanSettingsModal.vue'
import LastIncompleteModal from './LastIncompleteModal.vue'

const props = defineProps<{
  userId?: number
  readonly?: boolean  // 읽기 전용 모드 (타인 프로필)
}>()

const emit = defineEmits<{
  (e: 'day-click', date: { dateStr: string; day: number }): void
}>()

const calendarStore = useCalendarDisplayStore()
const api = useApi()

// 로컬 상태
const showSettingsModal = ref(false)
const showIncompleteModal = ref(false)
const isLoadingPositions = ref(false)

// readonly 모드용 로컬 상태
const localYear = ref(new Date().getFullYear())
const localMonth = ref(new Date().getMonth() + 1)
const localIsLoading = ref(false)
const localMonthData = ref<Record<string, CalendarDayData[]>>({})
const localSettings = ref<PlanDisplaySetting[]>([])
const localHiddenPlanIds = ref<Set<number>>(new Set())

// readonly 여부에 따라 상태 선택
const currentYear = computed(() => props.readonly ? localYear.value : calendarStore.currentYear)
const currentMonth = computed(() => props.readonly ? localMonth.value : calendarStore.currentMonth)
const isLoading = computed(() => props.readonly ? localIsLoading.value : calendarStore.isLoading)

const visiblePlans = computed(() => {
  if (props.readonly) {
    return localSettings.value.filter(s => !localHiddenPlanIds.value.has(s.plan_id))
  }
  return calendarStore.visiblePlans
})

const allActivePlans = computed(() => {
  if (props.readonly) {
    return localSettings.value.map(s => ({
      ...s,
      is_visible: !localHiddenPlanIds.value.has(s.plan_id)
    }))
  }
  return calendarStore.allActivePlans
})

const lastIncompletePositions = computed(() => calendarStore.lastIncompletePositions)

// readonly 모드에서 날짜별 데이터 조회
const getDisplayForDate = (date: string) => {
  if (props.readonly) {
    const dayData = localMonthData.value[date] || []
    const filtered = dayData.filter(d => !localHiddenPlanIds.value.has(d.plan_id))
    return {
      items: filtered.slice(0, 2),
      hasMore: filtered.length > 2,
      totalCount: filtered.length
    }
  }
  return calendarStore.getDisplayForDate(date)
}

// 요일 라벨
const weekDays = ['일', '월', '화', '수', '목', '금', '토']

// 달력 날짜 계산
const calendarDates = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value - 1 // JS에서는 0-indexed

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
  }> = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 이전 달 날짜
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = month === 0 ? 12 : month
    const prevYear = month === 0 ? year - 1 : year
    const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    dates.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: false
    })
  }

  // 현재 달 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    dates.push({
      day,
      dateStr,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime()
    })
  }

  // 다음 달 날짜 (6주 채우기)
  const remainingDays = 42 - dates.length
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 1 : month + 2
    const nextYear = month === 11 ? year + 1 : year
    const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    dates.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: false
    })
  }

  return dates
})

// readonly 모드용 API 호출
const fetchUserCalendarData = async (year: number, month: number) => {
  if (!props.userId) return

  localIsLoading.value = true
  try {
    const response = await api.get(`/api/v1/accounts/profile/${props.userId}/calendar/`, {
      params: { year, month }
    })

    if (response.data?.success) {
      // calendar 데이터를 날짜별로 그룹화
      const monthData: Record<string, CalendarDayData[]> = {}
      for (const item of response.data.data.calendar) {
        const dateStr = item.date
        if (!monthData[dateStr]) {
          monthData[dateStr] = []
        }
        monthData[dateStr].push({
          plan_id: item.plan_id,
          plan_name: item.plan_name,
          subscription_id: 0, // API에서 제공하지 않음
          color: item.color,
          book: item.book,
          chapters: item.chapters,
          is_completed: item.is_completed,
          schedule_id: item.schedule_id,
          is_visible: true
        })
      }
      localMonthData.value = monthData

      // plans 정보를 settings 형태로 변환
      localSettings.value = (response.data.data.plans || []).map((plan: any, index: number) => ({
        id: plan.id,
        subscription_id: 0,
        plan_id: plan.id,
        plan_name: plan.name,
        color: plan.color,
        display_order: index,
        is_visible: true,
        is_active: true
      }))

      localYear.value = year
      localMonth.value = month
    }
  } catch (error) {
    console.error('Failed to fetch user calendar data:', error)
  } finally {
    localIsLoading.value = false
  }
}

// 핸들러
const handlePrevMonth = async () => {
  if (props.readonly) {
    let newYear = localYear.value
    let newMonth = localMonth.value - 1
    if (newMonth < 1) {
      newMonth = 12
      newYear--
    }
    await fetchUserCalendarData(newYear, newMonth)
  } else {
    await calendarStore.goToPreviousMonth()
  }
}

const handleNextMonth = async () => {
  if (props.readonly) {
    let newYear = localYear.value
    let newMonth = localMonth.value + 1
    if (newMonth > 12) {
      newMonth = 1
      newYear++
    }
    await fetchUserCalendarData(newYear, newMonth)
  } else {
    await calendarStore.goToNextMonth()
  }
}

const handleGoToToday = async () => {
  if (props.readonly) {
    const today = new Date()
    await fetchUserCalendarData(today.getFullYear(), today.getMonth() + 1)
  } else {
    await calendarStore.goToToday()
  }
}

const handleToggleVisibility = async (id: number) => {
  if (props.readonly) {
    // readonly 모드에서는 로컬에서만 토글
    const setting = localSettings.value.find(s => s.id === id)
    if (setting) {
      if (localHiddenPlanIds.value.has(setting.plan_id)) {
        localHiddenPlanIds.value.delete(setting.plan_id)
      } else {
        localHiddenPlanIds.value.add(setting.plan_id)
      }
      // reactivity를 위해 새 Set 생성
      localHiddenPlanIds.value = new Set(localHiddenPlanIds.value)
    }
  } else {
    await calendarStore.toggleVisibility(id)
  }
}

const handleUpdateColor = async (id: number, color: string) => {
  if (!props.readonly) {
    await calendarStore.updateSetting(id, { color })
  }
}

const handleReorder = async (orderedIds: number[]) => {
  if (!props.readonly) {
    await calendarStore.reorderPlans(orderedIds)
  }
}

const handleDayClick = (date: { dateStr: string; day: number; isCurrentMonth: boolean }) => {
  if (date.isCurrentMonth) {
    emit('day-click', { dateStr: date.dateStr, day: date.day })
  }
}

const handleSelectIncomplete = async (position: { date: string }) => {
  showIncompleteModal.value = false
  if (!props.readonly) {
    await calendarStore.goToDate(position.date)
  }
}

// 미완료 위치 모달 열 때 데이터 로드 (readonly 아닐 때만)
watch(showIncompleteModal, async (isOpen) => {
  if (isOpen && !props.readonly) {
    isLoadingPositions.value = true
    await calendarStore.fetchLastIncompletePositions()
    isLoadingPositions.value = false
  }
})

// 초기 데이터 로드
onMounted(async () => {
  if (props.readonly && props.userId) {
    await fetchUserCalendarData(localYear.value, localMonth.value)
  } else {
    await calendarStore.fetchMonthData()
  }
})
</script>

<style scoped>
.multi-plan-calendar {
  background: var(--color-bg-card);
  border-radius: 12px;
  overflow: hidden;
}

.calendar-container {
  position: relative;
  padding: 1rem;
  transition: opacity 0.2s ease;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday-label {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-slate-500);
  padding: 0.5rem 0;
}

@media (max-width: 640px) {
  .calendar-container {
    padding: 0.75rem;
  }

  .calendar-grid {
    gap: 2px;
  }
}
</style>
