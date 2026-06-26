import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '~/composables/useApi'

interface HasenaResponseWrapped {
  success: boolean
  data: HasenaData
}

interface HasenaData {
  id: number
  date: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

interface HasenaRecord {
  id: number
  date: string
  is_completed: boolean
  created_at: string
}

interface HasenaCalendarEntry {
  date: string
  passage: string
  video_id: string
  title: string
  is_completed: boolean
}

interface HasenaStats {
  total_completed: number
  current_streak: number
  longest_streak: number
}

type HasenaResponse = HasenaResponseWrapped | HasenaData

export const useHasenaStore = defineStore('hasena', () => {
  const api = useApi()
  
  const isCompleted = ref<boolean>(false)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  
  const calendarRecords = ref<HasenaRecord[]>([])
  const calendarEntries = ref<HasenaCalendarEntry[]>([])
  const stats = ref<HasenaStats>({
    total_completed: 0,
    current_streak: 0,
    longest_streak: 0
  })
  
  // 날짜 포맷 함수
  const formatApiDate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  
  // 하세나 완료 상태 조회
  const fetchStatus = async (): Promise<HasenaResponse | null> => {
    // 인증되지 않은 사용자는 API 호출하지 않음 (401 방지)
    const { useAuthService } = await import('~/composables/useAuthService')
    const auth = useAuthService()
    if (!auth.isAuthenticated.value) {
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const { data } = await api.get<HasenaResponse>('/api/v1/todos/hasena/status/')
      if (data.success) {
        isCompleted.value = data.data.is_completed
      }
      return data
    } catch (err: any) {
      error.value = err.message || '완료 상태를 불러오는데 실패했습니다'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  // 하세나 완료 상태 업데이트 (오늘 날짜용)
  const updateStatus = async (date: Date): Promise<any> => {
    isLoading.value = true
    error.value = null
    
    try {
      const formattedDate = formatApiDate(date)
      
      const response = await api.post('/api/v1/todos/hasena/update/', {
        date: formattedDate,
        is_completed: !isCompleted.value
      })
      
      // 응답 구조 분석 및 안전한 처리
      if (response?.success && response?.data) {
        isCompleted.value = response.data.is_completed
      } else if (response?.is_completed !== undefined) {
        isCompleted.value = response.is_completed
      } else if (response?.data) {
        // 응답 구조에 따라 처리
        if (response.data.success && response.data.data) {
          // success 필드가 있는 경우
          isCompleted.value = response.data.data.is_completed
        } else if (response.data.is_completed !== undefined) {
          // 직접 데이터가 반환되는 경우
          isCompleted.value = response.data.is_completed
        }
      }
      
      return response
    } catch (err: any) {
      error.value = err.message || '완료 처리에 실패했습니다'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  // 특정 날짜의 완료 상태 업데이트 (달력용)
  const updateStatusForDate = async (date: Date, currentCompleted: boolean): Promise<any> => {
    error.value = null
    
    try {
      const formattedDate = formatApiDate(date)
      
      const response = await api.post('/api/v1/todos/hasena/update/', {
        date: formattedDate,
        is_completed: !currentCompleted
      })
      
      // 오늘 날짜인 경우 isCompleted도 업데이트
      const todayStr = formatApiDate(new Date())
      if (formattedDate === todayStr) {
        if (response?.success && response?.data) {
          isCompleted.value = response.data.is_completed
        } else if (response?.data?.success && response.data?.data) {
          isCompleted.value = response.data.data.is_completed
        } else if (response?.is_completed !== undefined) {
          isCompleted.value = response.is_completed
        } else if (response?.data?.is_completed !== undefined) {
          isCompleted.value = response.data.is_completed
        }
      }
      
      return response
    } catch (err: any) {
      error.value = err.message || '완료 처리에 실패했습니다'
      throw err
    }
  }
  
  const fetchCalendarRecords = async (year: number, month: number): Promise<HasenaRecord[]> => {
    const { useAuthService } = await import('~/composables/useAuthService')
    const auth = useAuthService()
    if (!auth.isAuthenticated.value) {
      return []
    }

    try {
      const { data } = await api.get<HasenaRecord[]>(`/api/v1/todos/hasena/?year=${year}&month=${month}`)
      calendarRecords.value = data
      return data
    } catch (err: any) {
      console.error('Failed to fetch hasena calendar records:', err)
      return []
    }
  }

  const fetchCalendarEntries = async (year: number, month: number): Promise<HasenaCalendarEntry[]> => {
    try {
      const { data } = await api.get<{ success: boolean; entries: HasenaCalendarEntry[] }>(
        `/api/v1/todos/hasena/calendar/?year=${year}&month=${month}`
      )
      calendarEntries.value = data.entries || []
      calendarRecords.value = calendarEntries.value.map((entry, index) => ({
        id: index,
        date: entry.date,
        is_completed: entry.is_completed,
        created_at: entry.date
      }))
      return calendarEntries.value
    } catch (err: any) {
      console.error('Failed to fetch hasena calendar entries:', err)
      calendarEntries.value = []
      return []
    }
  }

  const setCompletionStatus = (completed: boolean): void => {
    isCompleted.value = completed
  }
  
  const fetchStats = async (): Promise<HasenaStats | null> => {
    const { useAuthService } = await import('~/composables/useAuthService')
    const auth = useAuthService()
    if (!auth.isAuthenticated.value) {
      return null
    }

    try {
      const { data } = await api.get<{ success: boolean; data: HasenaStats }>('/api/v1/todos/hasena/stats/')
      if (data.success) {
        stats.value = data.data
        return data.data
      }
      return null
    } catch (err: any) {
      console.error('Failed to fetch hasena stats:', err)
      return null
    }
  }
  
  const reset = (): void => {
    isCompleted.value = false
    isLoading.value = false
    error.value = null
    calendarRecords.value = []
    calendarEntries.value = []
    stats.value = { total_completed: 0, current_streak: 0, longest_streak: 0 }
  }
  
  return {
    isCompleted,
    isLoading,
    error,
    calendarRecords,
    calendarEntries,
    stats,
    fetchStatus,
    updateStatus,
    updateStatusForDate,
    fetchCalendarRecords,
    fetchCalendarEntries,
    setCompletionStatus,
    fetchStats,
    reset
  }
})
