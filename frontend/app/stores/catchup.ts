import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { getTodayString } from '~/utils/dateFormat'
import type {
  CatchupSession,
  CatchupSchedule,
  CatchupStatus,
  CatchupSettings,
  CatchupPreviewResult
} from '~/composables/useCatchup'
import type { components } from '~/types/generated/api-schema'

const normalizeCatchupSession = (
  session: components['schemas']['CatchupSessionResponse'],
): CatchupSession => ({
  ...session,
  strategy: session.strategy ?? 'parallel',
  target_rejoin_date: session.target_rejoin_date ?? null,
  max_daily_readings: session.max_daily_readings ?? null,
  max_daily_chapters: session.max_daily_chapters ?? null,
  weekend_multiplier: Number(session.weekend_multiplier ?? 1),
})

const normalizeCatchupStatus = (
  response: components['schemas']['CatchupStatusResponse'],
): CatchupStatus => ({
  ...response,
  overdue_range: response.overdue_range
    ? {
        start: response.overdue_range.start ?? '',
        end: response.overdue_range.end ?? '',
      }
    : null,
  active_catchup_session: response.active_catchup_session
    ? normalizeCatchupSession(response.active_catchup_session)
    : null,
})

const normalizeCatchupPreview = (
  response: components['schemas']['CatchupPreviewResponse'],
): CatchupPreviewResult => ({
  ...response,
  summary: {
    total_schedules: response.summary.total_schedules ?? 0,
    total_chapters: response.summary.total_chapters ?? 0,
    daily_average_readings: response.summary.daily_average_readings ?? 0,
    daily_average_chapters: response.summary.daily_average_chapters ?? 0,
    estimated_days: response.summary.estimated_days ?? 0,
    rejoin_date: response.summary.rejoin_date ?? null,
  },
})

export const useCatchupStore = defineStore('catchup', () => {
  const api = useApi()

  // State
  const activeSession = ref<CatchupSession | null>(null)
  const activeSessions = ref<CatchupSession[]>([])
  const todaySchedules = ref<CatchupSchedule[]>([])
  const status = ref<CatchupStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const hasActiveSession = computed(() => !!activeSession.value)
  const progressPercentage = computed(() => activeSession.value?.progress_percentage ?? 0)
  const isParallelMode = computed(() => activeSession.value?.strategy === 'parallel')
  const todayTotalCount = computed(() => todaySchedules.value.length)
  const todayCompletedCount = computed(() => todaySchedules.value.filter(s => s.is_completed).length)

  // Actions
  const fetchStatus = async (subscriptionId: number) => {
    loading.value = true
    error.value = null
    try {
      const res = await api.GET(api.path(
        '/api/v1/todos/subscriptions/{subscription_id}/catchup-status/',
        { subscription_id: subscriptionId },
      ))
      status.value = normalizeCatchupStatus(res.data)
      if (status.value?.active_catchup_session) {
        activeSession.value = status.value.active_catchup_session
      }
    } catch (e: any) {
      error.value = e.message || '현황을 불러올 수 없습니다'
    } finally {
      loading.value = false
    }
  }

  const fetchActiveSessions = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await api.GET('/api/v1/todos/catchup-sessions/active/')
      activeSessions.value = res.data.map(normalizeCatchupSession)
      const firstSession = activeSessions.value[0]
      if (firstSession) {
        activeSession.value = firstSession
      }
    } catch (e: any) {
      error.value = e.message || '세션 목록을 불러올 수 없습니다'
    } finally {
      loading.value = false
    }
  }

  const fetchTodaySchedules = async () => {
    if (!activeSession.value) return

    loading.value = true
    error.value = null
    try {
      const today = getTodayString()
      const res = await api.GET(
        api.path('/api/v1/todos/catchup-sessions/{session_id}/schedules/', {
          session_id: activeSession.value.id
        }),
        { params: { date: today } }
      )
      const todaySchedule = res.data.schedules[0]
      if (todaySchedule) {
        todaySchedules.value = todaySchedule.items.map(schedule => ({
          ...schedule,
          is_completed: schedule.is_completed ?? false
        }))
      } else {
        todaySchedules.value = []
      }
    } catch (e: any) {
      error.value = e.message || '스케줄을 불러올 수 없습니다'
    } finally {
      loading.value = false
    }
  }

  const toggleSchedule = async (scheduleId: number) => {
    loading.value = true
    error.value = null
    try {
      const result = await api.POST(api.path(
        '/api/v1/todos/catchup-schedules/{schedule_id}/toggle/',
        { schedule_id: scheduleId },
      ))

      // Update local state
      const schedule = todaySchedules.value.find(s => s.id === scheduleId)
      if (schedule) {
        schedule.is_completed = result.is_completed
        schedule.completed_at = result.completed_at
      }

      // Update session progress
      if (activeSession.value && result.session_progress) {
        activeSession.value.progress_percentage = result.session_progress.percentage
        activeSession.value.completed_count = result.session_progress.completed
        activeSession.value.total_count = result.session_progress.total
      }

      return result
    } catch (e: any) {
      error.value = e.message || '완료 처리에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  const createSession = async (subscriptionId: number, settings: CatchupSettings) => {
    loading.value = true
    error.value = null
    try {
      const session = await api.POST(
        api.path('/api/v1/todos/subscriptions/{subscription_id}/catchup/', {
          subscription_id: subscriptionId,
        }),
        settings,
      )
      activeSession.value = normalizeCatchupSession(session)
      return activeSession.value
    } catch (e: any) {
      error.value = e.message || '따라잡기 생성에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  const completeSession = async () => {
    if (!activeSession.value) return null

    loading.value = true
    error.value = null
    try {
      const result = await api.POST(api.path(
        '/api/v1/todos/catchup-sessions/{session_id}/complete/',
        { session_id: activeSession.value.id },
      ))
      activeSession.value = null
      todaySchedules.value = []
      return result
    } catch (e: any) {
      error.value = e.message || '완료 처리에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  const abandonSession = async () => {
    if (!activeSession.value) return null

    loading.value = true
    error.value = null
    try {
      const result = await api.POST(api.path(
        '/api/v1/todos/catchup-sessions/{session_id}/abandon/',
        { session_id: activeSession.value.id },
      ))
      activeSession.value = null
      todaySchedules.value = []
      return result
    } catch (e: any) {
      error.value = e.message || '포기 처리에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  const updateSession = async (updates: Partial<CatchupSettings> & { recalculate?: boolean }) => {
    if (!activeSession.value) return null

    loading.value = true
    error.value = null
    try {
      const session = await api.PATCH(
        api.path('/api/v1/todos/catchup-sessions/{session_id}/update/', {
          session_id: activeSession.value.id,
        }),
        updates,
      )
      activeSession.value = normalizeCatchupSession(session)
      return activeSession.value
    } catch (e: any) {
      error.value = e.message || '수정에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  const fetchPreview = async (subscriptionId: number, settings: CatchupSettings) => {
    loading.value = true
    error.value = null
    try {
      const result = await api.POST(
        api.path('/api/v1/todos/subscriptions/{subscription_id}/catchup/preview/', {
          subscription_id: subscriptionId,
        }),
        settings,
      )
      return normalizeCatchupPreview(result)
    } catch (e: any) {
      error.value = e.message || '미리보기를 불러올 수 없습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  const clearSession = () => {
    activeSession.value = null
    todaySchedules.value = []
    status.value = null
    error.value = null
  }

  return {
    // State
    activeSession,
    activeSessions,
    todaySchedules,
    status,
    loading,
    error,

    // Getters
    hasActiveSession,
    progressPercentage,
    isParallelMode,
    todayTotalCount,
    todayCompletedCount,

    // Actions
    fetchStatus,
    fetchActiveSessions,
    fetchTodaySchedules,
    toggleSchedule,
    createSession,
    completeSession,
    abandonSession,
    updateSession,
    fetchPreview,
    clearSession,
  }
})
