import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { components } from '~/types/generated/api-schema'

export interface PlanDisplaySetting {
  id: number
  subscription_id: number
  plan_id: number
  plan_name: string
  color: string
  display_order: number
  is_visible: boolean
  is_active: boolean
}

export interface CalendarDayData {
  plan_id: number
  plan_name: string
  subscription_id: number
  color: string
  book: string
  chapters: string
  is_completed: boolean
  schedule_id: number
  is_visible: boolean
}

export interface LastIncompletePosition {
  plan_id: number
  plan_name: string
  subscription_id: number
  color: string
  date: string
  book: string
  chapters: string
  schedule_id: number
}

interface CalendarDisplayState {
  settings: PlanDisplaySetting[]
  monthData: Record<string, CalendarDayData[]>
  lastIncompletePositions: LastIncompletePosition[]
  currentYear: number
  currentMonth: number
  isLoading: boolean
  isSettingsLoading: boolean
  error: string | null
}

const normalizeSetting = (
  setting: components['schemas']['UserPlanDisplaySettings']
): PlanDisplaySetting => ({
  ...setting,
  color: setting.color ?? '#3B82F6',
  display_order: setting.display_order ?? 0,
  is_visible: setting.is_visible ?? true
})

const getApiError = (response: unknown): any =>
  typeof response === 'object' && response !== null && 'error' in response
    ? response.error
    : undefined

export const useCalendarDisplayStore = defineStore('calendarDisplay', {
  state: (): CalendarDisplayState => ({
    settings: [],
    monthData: {},
    lastIncompletePositions: [],
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    isLoading: false,
    isSettingsLoading: false,
    error: null
  }),

  getters: {
    // 표시 가능한 플랜 목록 (순서대로)
    visiblePlans: (state) =>
      state.settings
        .filter(s => s.is_visible && s.is_active)
        .sort((a, b) => a.display_order - b.display_order),

    // 숨겨진 플랜 목록
    hiddenPlans: (state) =>
      state.settings.filter(s => !s.is_visible && s.is_active),

    // 모든 활성 플랜 (순서대로)
    allActivePlans: (state) =>
      state.settings
        .filter(s => s.is_active)
        .sort((a, b) => a.display_order - b.display_order),

    // 특정 날짜의 표시 데이터 (최대 2개 + hasMore)
    getDisplayForDate: (state) => (date: string) => {
      const dayData = state.monthData[date] || []
      const visiblePlanIds = state.settings
        .filter(s => s.is_visible && s.is_active)
        .map(s => s.plan_id)

      const filtered = dayData
        .filter(d => visiblePlanIds.includes(d.plan_id))
        .sort((a, b) => {
          const aOrder = state.settings.find(s => s.plan_id === a.plan_id)?.display_order ?? 999
          const bOrder = state.settings.find(s => s.plan_id === b.plan_id)?.display_order ?? 999
          return aOrder - bOrder
        })

      return {
        items: filtered.slice(0, 2),
        hasMore: filtered.length > 2,
        totalCount: filtered.length
      }
    },

    // 특정 날짜의 모든 데이터 (모달용)
    getAllDataForDate: (state) => (date: string) => {
      const dayData = state.monthData[date] || []
      const visiblePlanIds = state.settings
        .filter(s => s.is_visible && s.is_active)
        .map(s => s.plan_id)

      return dayData
        .filter(d => visiblePlanIds.includes(d.plan_id))
        .sort((a, b) => {
          const aOrder = state.settings.find(s => s.plan_id === a.plan_id)?.display_order ?? 999
          const bOrder = state.settings.find(s => s.plan_id === b.plan_id)?.display_order ?? 999
          return aOrder - bOrder
        })
    },

    // 플랜 ID로 색상 가져오기
    getColorForPlan: (state) => (planId: number) => {
      const setting = state.settings.find(s => s.plan_id === planId)
      return setting?.color || '#3B82F6'
    }
  },

  actions: {
    // 설정 조회
    async fetchSettings() {
      this.isSettingsLoading = true
      this.error = null

      try {
        const api = useApi()
        const response = await api.GET('/api/v1/todos/calendar/settings/')

        if (response.data?.success) {
          this.settings = response.data.settings.map(normalizeSetting)
        } else {
          this.error = getApiError(response.data) || '설정을 불러올 수 없습니다.'
        }
      } catch (error: any) {
        this.error = error.message || '설정 조회 중 오류가 발생했습니다.'
      } finally {
        this.isSettingsLoading = false
      }
    },

    // 개별 설정 업데이트 (색상, 가시성)
    async updateSetting(id: number, data: Partial<Pick<PlanDisplaySetting, 'color' | 'is_visible'>>) {
      // Optimistic update
      const index = this.settings.findIndex(s => s.id === id)
      const previousSetting = index !== -1 ? { ...this.settings[index] } : null

      if (index !== -1) {
        Object.assign(this.settings[index], data)
      }

      try {
        const api = useApi()
        const response = await api.PATCH(
          api.path('/api/v1/todos/calendar/settings/{id}/', { id }),
          data
        )

        if (response.success) {
          // 서버 응답으로 갱신
          if (index !== -1) {
            this.settings[index] = normalizeSetting(response.setting)
          }
          return { success: true }
        } else {
          // 롤백
          if (previousSetting && index !== -1) {
            this.settings[index] = previousSetting
          }
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        // 롤백
        if (previousSetting && index !== -1) {
          this.settings[index] = previousSetting
        }
        return { success: false, error: error.message }
      }
    },

    // 가시성 토글
    async toggleVisibility(id: number) {
      const setting = this.settings.find(s => s.id === id)
      if (setting) {
        return this.updateSetting(id, { is_visible: !setting.is_visible })
      }
      return { success: false, error: '설정을 찾을 수 없습니다.' }
    },

    // 플랜 순서 변경
    async reorderPlans(orderedIds: number[]) {
      // Optimistic update
      const previousSettings = [...this.settings]
      const orders = orderedIds.map((id, index) => ({ id, display_order: index }))

      orders.forEach(order => {
        const setting = this.settings.find(s => s.id === order.id)
        if (setting) {
          setting.display_order = order.display_order
        }
      })

      try {
        const api = useApi()
        const response = await api.POST('/api/v1/todos/calendar/settings/reorder/', { orders })

        if (response.success) {
          this.settings = response.settings.map(normalizeSetting)
          return { success: true }
        } else {
          // 롤백
          this.settings = previousSettings
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        // 롤백
        this.settings = previousSettings
        return { success: false, error: error.message }
      }
    },

    // 월별 데이터 조회
    async fetchMonthData(year?: number, month?: number) {
      const targetYear = year ?? this.currentYear
      const targetMonth = month ?? this.currentMonth

      this.isLoading = true
      this.error = null

      try {
        const api = useApi()
        const response = await api.GET('/api/v1/todos/calendar/month/', {
          params: { year: targetYear, month: targetMonth }
        })

        if (response.data?.success) {
          this.monthData = response.data.calendar
          this.settings = response.data.settings.map(normalizeSetting)
          this.currentYear = targetYear
          this.currentMonth = targetMonth
          return { success: true }
        } else {
          this.error = getApiError(response.data) || '캘린더 데이터를 불러올 수 없습니다.'
          return { success: false, error: this.error }
        }
      } catch (error: any) {
        this.error = error.message || '캘린더 조회 중 오류가 발생했습니다.'
        return { success: false, error: this.error }
      } finally {
        this.isLoading = false
      }
    },

    // 이전 달로 이동
    async goToPreviousMonth() {
      let newYear = this.currentYear
      let newMonth = this.currentMonth - 1

      if (newMonth < 1) {
        newMonth = 12
        newYear--
      }

      return this.fetchMonthData(newYear, newMonth)
    },

    // 다음 달로 이동
    async goToNextMonth() {
      let newYear = this.currentYear
      let newMonth = this.currentMonth + 1

      if (newMonth > 12) {
        newMonth = 1
        newYear++
      }

      return this.fetchMonthData(newYear, newMonth)
    },

    // 오늘로 이동
    async goToToday() {
      const today = new Date()
      return this.fetchMonthData(today.getFullYear(), today.getMonth() + 1)
    },

    // 특정 날짜로 이동
    async goToDate(date: Date | string) {
      const targetDate = typeof date === 'string' ? new Date(date) : date
      return this.fetchMonthData(targetDate.getFullYear(), targetDate.getMonth() + 1)
    },

    // 마지막 미완료 위치 조회
    async fetchLastIncompletePositions() {
      try {
        const api = useApi()
        const response = await api.GET('/api/v1/todos/calendar/last-incomplete/')

        if (response.data?.success) {
          this.lastIncompletePositions = response.data.positions
          return { success: true, positions: response.data.positions }
        } else {
          return { success: false, error: getApiError(response.data) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    // 데이터 초기화
    clearData() {
      this.settings = []
      this.monthData = {}
      this.lastIncompletePositions = []
      this.error = null
    }
  }
})
