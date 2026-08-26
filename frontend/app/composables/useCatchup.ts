import { ref, computed, type Ref } from 'vue'
import { useApi } from './useApi'
import type { components } from '~/types/generated/api-schema'

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

const normalizeCatchupSchedules = (
  response: components['schemas']['CatchupSessionSchedulesResponse'],
): CatchupSchedulesResponse => ({
  ...response,
  session: normalizeCatchupSession(response.session),
  schedules: response.schedules.map(day => ({
    ...day,
    items: day.items.map(schedule => ({
      ...schedule,
      is_completed: schedule.is_completed ?? false,
    })),
  })),
})

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
      const res = await api.GET(api.path(
        '/api/v1/todos/subscriptions/{subscription_id}/catchup-status/',
        { subscription_id: id },
      ))
      status.value = normalizeCatchupStatus(res.data)
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
      const result = await api.POST(
        api.path('/api/v1/todos/subscriptions/{subscription_id}/catchup/preview/', {
          subscription_id: id,
        }),
        settings,
      )
      preview.value = normalizeCatchupPreview(result)
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
      const result = await api.POST(
        api.path('/api/v1/todos/subscriptions/{subscription_id}/catchup/', {
          subscription_id: id,
        }),
        settings,
      )
      currentSession.value = normalizeCatchupSession(result)
      return currentSession.value
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
      const res = await api.GET('/api/v1/todos/catchup-sessions/active/')
      activeSessions.value = res.data.map(normalizeCatchupSession)
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
      const res = await api.GET(api.path(
        '/api/v1/todos/catchup-sessions/{session_id}/',
        { session_id: sessionId },
      ))
      currentSession.value = normalizeCatchupSession(res.data)
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
      const res = await api.GET(
        api.path('/api/v1/todos/catchup-sessions/{session_id}/schedules/', {
          session_id: sessionId,
        }),
        { params: { date } },
      )
      schedules.value = normalizeCatchupSchedules(res.data)
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
      const result = await api.POST(api.path(
        '/api/v1/todos/catchup-schedules/{schedule_id}/toggle/',
        { schedule_id: scheduleId },
      ))
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
      const result = await api.POST(api.path(
        '/api/v1/todos/catchup-sessions/{session_id}/complete/',
        { session_id: sessionId },
      ))
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
      const result = await api.POST(api.path(
        '/api/v1/todos/catchup-sessions/{session_id}/abandon/',
        { session_id: sessionId },
      ))
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
      const result = await api.PATCH(
        api.path('/api/v1/todos/catchup-sessions/{session_id}/update/', {
          session_id: sessionId,
        }),
        updates,
      )
      currentSession.value = normalizeCatchupSession(result)
      return currentSession.value
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
