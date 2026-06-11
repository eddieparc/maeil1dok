import { ref, computed, type Ref } from 'vue'
import { useApi } from './useApi'

// Type definitions
export interface OverdueSchedule {
  id: number
  date: string
  book: string
  start_chapter: number
  end_chapter: number
}

export interface OverdueRange {
  start: string
  end: string
}

export interface SuggestedSettings {
  max_daily_readings: number
  estimated_days: number
  estimated_rejoin_date: string
}

export interface CatchupSession {
  id: number
  name: string
  subscription: number
  plan_name: string
  range_start: string
  range_end: string
  strategy: 'parallel' | 'sequential'
  target_rejoin_date: string | null
  max_daily_readings: number | null
  max_daily_chapters: number | null
  weekend_multiplier: number
  status: 'active' | 'completed' | 'abandoned'
  completed_at: string | null
  progress_percentage: number
  completed_count: number
  total_count: number
  remaining_count: number
  created_at: string
  updated_at: string
}

export interface CatchupStatus {
  has_overdue: boolean
  overdue_count: number
  overdue_chapters: number
  overdue_range: OverdueRange | null
  overdue_schedules: OverdueSchedule[]
  active_catchup_session: CatchupSession | null
  suggested_settings: SuggestedSettings
}

export interface CatchupSettings {
  name: string
  range_start: string
  range_end: string
  strategy: 'parallel' | 'sequential'
  max_daily_readings?: number | null
  max_daily_chapters?: number | null
  weekend_multiplier: number
  target_rejoin_date?: string | null
}

export interface PreviewScheduleItem {
  original_date: string
  book: string
  start_chapter: number
  end_chapter: number
}

export interface PreviewDaySchedule {
  date: string
  is_weekend: boolean
  items: PreviewScheduleItem[]
  total_chapters: number
}

export interface PreviewSummary {
  total_schedules: number
  total_chapters: number
  daily_average_readings: number
  daily_average_chapters: number
  estimated_days: number
  rejoin_date: string | null
}

export interface CatchupPreviewResult {
  valid: boolean
  summary: PreviewSummary
  preview_schedules: PreviewDaySchedule[]
  warnings: string[]
}

export interface CatchupSchedule {
  id: number
  session: number
  scheduled_date: string
  book: string
  start_chapter: number
  end_chapter: number
  original_date: string
  audio_link: string | null
  guide_link: string | null
  is_completed: boolean
  completed_at: string | null
}

export interface CatchupSchedulesResponse {
  session: CatchupSession
  schedules: Array<{
    date: string
    is_weekend: boolean
    items: CatchupSchedule[]
  }>
}

export const useCatchup = (subscriptionId?: Ref<number | null>) => {
  const api = useApi()

  const status = ref<CatchupStatus | null>(null)
  const preview = ref<CatchupPreviewResult | null>(null)
  const activeSessions = ref<CatchupSession[]>([])
  const currentSession = ref<CatchupSession | null>(null)
  const schedules = ref<CatchupSchedulesResponse | null>(null)

  const loading = ref(false)
  const error = ref<string | null>(null)

  // Fetch overdue status for a subscription
  const fetchStatus = async (subId?: number) => {
    const id = subId ?? subscriptionId?.value
    if (!id) {
      error.value = '구독 ID가 필요합니다'
      return
    }

    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/api/v1/todos/subscriptions/${id}/catchup-status/`)
      status.value = res.data
    } catch (e: any) {
      error.value = e.message || '현황을 불러올 수 없습니다'
      status.value = null
    } finally {
      loading.value = false
    }
  }

  // Preview catchup schedule distribution
  const fetchPreview = async (settings: CatchupSettings, subId?: number) => {
    const id = subId ?? subscriptionId?.value
    if (!id) {
      error.value = '구독 ID가 필요합니다'
      return
    }

    loading.value = true
    error.value = null
    try {
      preview.value = await api.post(`/api/v1/todos/subscriptions/${id}/catchup/preview/`, settings)
    } catch (e: any) {
      error.value = e.message || '미리보기를 불러올 수 없습니다'
      preview.value = null
    } finally {
      loading.value = false
    }
  }

  // Create a new catchup session
  const createSession = async (settings: CatchupSettings, subId?: number) => {
    const id = subId ?? subscriptionId?.value
    if (!id) {
      error.value = '구독 ID가 필요합니다'
      return null
    }

    loading.value = true
    error.value = null
    try {
      const result = await api.post(`/api/v1/todos/subscriptions/${id}/catchup/`, settings)
      currentSession.value = result as CatchupSession
      return result as CatchupSession
    } catch (e: any) {
      error.value = e.message || '따라잡기 생성에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  // Fetch all active catchup sessions
  const fetchActiveSessions = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await api.get('/api/v1/todos/catchup-sessions/active/')
      activeSessions.value = res.data
    } catch (e: any) {
      error.value = e.message || '세션 목록을 불러올 수 없습니다'
      activeSessions.value = []
    } finally {
      loading.value = false
    }
  }

  // Fetch session detail
  const fetchSession = async (sessionId: number) => {
    loading.value = true
    error.value = null
    try {
      const res = await api.get(`/api/v1/todos/catchup-sessions/${sessionId}/`)
      currentSession.value = res.data
    } catch (e: any) {
      error.value = e.message || '세션 정보를 불러올 수 없습니다'
      currentSession.value = null
    } finally {
      loading.value = false
    }
  }

  // Fetch session schedules
  const fetchSchedules = async (sessionId: number, date?: string) => {
    loading.value = true
    error.value = null
    try {
      const url = date
        ? `/api/v1/todos/catchup-sessions/${sessionId}/schedules/?date=${date}`
        : `/api/v1/todos/catchup-sessions/${sessionId}/schedules/`
      const res = await api.get(url)
      schedules.value = res.data
    } catch (e: any) {
      error.value = e.message || '스케줄을 불러올 수 없습니다'
      schedules.value = null
    } finally {
      loading.value = false
    }
  }

  // Toggle schedule completion
  const toggleSchedule = async (scheduleId: number) => {
    loading.value = true
    error.value = null
    try {
      const result = await api.post(`/api/v1/todos/catchup-schedules/${scheduleId}/toggle/`)
      return result
    } catch (e: any) {
      error.value = e.message || '완료 처리에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  // Complete session
  const completeSession = async (sessionId: number) => {
    loading.value = true
    error.value = null
    try {
      const result = await api.post(`/api/v1/todos/catchup-sessions/${sessionId}/complete/`)
      return result
    } catch (e: any) {
      error.value = e.message || '완료 처리에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  // Abandon session
  const abandonSession = async (sessionId: number) => {
    loading.value = true
    error.value = null
    try {
      const result = await api.post(`/api/v1/todos/catchup-sessions/${sessionId}/abandon/`)
      return result
    } catch (e: any) {
      error.value = e.message || '포기 처리에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update session settings
  const updateSession = async (sessionId: number, updates: Partial<CatchupSettings> & { recalculate?: boolean }) => {
    loading.value = true
    error.value = null
    try {
      const result = await api.patch(`/api/v1/todos/catchup-sessions/${sessionId}/update/`, updates)
      currentSession.value = result as CatchupSession
      return result as CatchupSession
    } catch (e: any) {
      error.value = e.message || '수정에 실패했습니다'
      return null
    } finally {
      loading.value = false
    }
  }

  // Computed helpers
  const hasOverdue = computed(() => status.value?.has_overdue ?? false)
  const hasActiveSession = computed(() => status.value?.active_catchup_session != null)
  const overdueCount = computed(() => status.value?.overdue_count ?? 0)

  return {
    // State
    status,
    preview,
    activeSessions,
    currentSession,
    schedules,
    loading,
    error,

    // Actions
    fetchStatus,
    fetchPreview,
    createSession,
    fetchActiveSessions,
    fetchSession,
    fetchSchedules,
    toggleSchedule,
    completeSession,
    abandonSession,
    updateSession,

    // Computed
    hasOverdue,
    hasActiveSession,
    overdueCount,
  }
}
