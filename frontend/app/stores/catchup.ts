import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '~/composables/useApi'
import { getTodayString } from '~/utils/dateFormat'
import type {
  CatchupSession,
  CatchupSchedule,
  CatchupStatus,
  CatchupSettings,
  CatchupPreviewResult,
  CatchupSchedulesResponse
} from '~/composables/useCatchup'

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
      const res = await api.get(`/api/v1/todos/subscriptions/${subscriptionId}/catchup-status/`)
      status.value = res.data
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
      const res = await api.get('/api/v1/todos/catchup-sessions/active/')
      activeSessions.value = res.data
      if (activeSessions.value.length > 0) {
        activeSession.value = activeSessions.value[0]
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
      const res = await api.get(
        `/api/v1/todos/catchup-sessions/${activeSession.value.id}/schedules/?date=${today}`
      )
      const response: CatchupSchedulesResponse = res.data
      if (response?.schedules?.length > 0) {
        todaySchedules.value = response.schedules[0].items
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
      const result = await api.post(`/api/v1/todos/catchup-schedules/${scheduleId}/toggle/`)

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
      const session = await api.post(`/api/v1/todos/subscriptions/${subscriptionId}/catchup/`, settings)
      activeSession.value = session as CatchupSession
      return session as CatchupSession
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
      const result = await api.post(`/api/v1/todos/catchup-sessions/${activeSession.value.id}/complete/`)
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
      const result = await api.post(`/api/v1/todos/catchup-sessions/${activeSession.value.id}/abandon/`)
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
      const session = await api.patch(
        `/api/v1/todos/catchup-sessions/${activeSession.value.id}/update/`,
        updates
      )
      activeSession.value = session as CatchupSession
      return session as CatchupSession
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
      const result = await api.post(
        `/api/v1/todos/subscriptions/${subscriptionId}/catchup/preview/`,
        settings
      )
      return result as CatchupPreviewResult
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
