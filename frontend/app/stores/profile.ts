import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'

interface UserProfile {
  id: number
  user: {
    id: number
    username: string
    nickname: string
    profile_image?: string
    is_staff?: boolean
  }
  bio: string
  total_completed_days: number
  current_streak: number
  longest_streak: number
  joined_date: string
  is_public: boolean
  followers_count: number
  following_count: number
  is_following?: boolean
  is_mutual_follow?: boolean
}

interface Achievement {
  id: number | null
  achievement_type: string
  title: string
  description: string
  icon: string
  order: number
  unlocked: boolean
  unlockedAt: string | null
  milestone_value: number
}

interface CalendarData {
  date: string
  is_completed: boolean
  book: string
  chapters: string
  start_chapter?: number
  end_chapter?: number
  plan_id?: number
  plan_name?: string
  color?: string
  schedule_id?: number
  schedule_text?: string
}

interface CalendarPlan {
  id: number
  name: string
  color: string
}

export const useProfileStore = defineStore('profile', {
  state: () => ({
    currentProfile: null as UserProfile | null,
    achievements: [] as Achievement[],
    calendarData: [] as CalendarData[],
    calendarPlans: [] as CalendarPlan[],
    isLoading: false,
    error: null as string | null
  }),

  getters: {
    profileUser: (state) => state.currentProfile?.user,
    isOwnProfile: (state) => {
      const auth = useAuthService()
      return state.currentProfile?.user.id === auth.user.value?.id
    },
    completionRate: (state) => {
      if (!state.currentProfile) return 0
      // 예상 일수 계산 (예: 365일 기준)
      const expectedDays = 365
      return Math.min((state.currentProfile.total_completed_days / expectedDays) * 100, 100)
    }
  },

  actions: {
    async fetchProfile(userId: number) {
      this.isLoading = true
      this.error = null

      try {
        const response = await useApi().get(`/api/v1/accounts/profile/${userId}/`)
        if (response.data?.success) {
          this.currentProfile = response.data.data?.profile || response.data.profile
        } else {
          this.error = response.data?.error || '프로필을 불러올 수 없습니다.'
        }
      } catch (error: any) {
        this.error = error.message || '프로필 조회 중 오류가 발생했습니다.'
      } finally {
        this.isLoading = false
      }
    },

    async updateProfile(bio: string, isPublic: boolean) {
      try {
        const data = await useApi().put('/api/v1/accounts/profile/', {
          bio,
          is_public: isPublic
        })
        
        if (data?.success) {
          this.currentProfile = data.profile
          return { success: true }
        } else {
          return { success: false, error: data?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async fetchAchievements(userId: number) {
      try {
        const response = await useApi().get(`/api/v1/accounts/profile/${userId}/achievements/`)
        if (response.data?.success) {
          // 하위 호환: response.data.data?.achievements 또는 response.data.achievements
          this.achievements = response.data.data?.achievements ?? response.data.achievements ?? []
        }
      } catch (error) {
        console.error('업적 조회 실패:', error)
      }
    },

    async fetchCalendarData(userId: number, year: number, month: number) {
      try {
        const response = await useApi().get(`/api/v1/accounts/profile/${userId}/calendar/`, {
          params: { year, month }
        })

        if (response.data?.success) {
          const data = response.data.data ?? response.data
          this.calendarData = data.calendar ?? []
          this.calendarPlans = data.plans ?? []
        }
      } catch (error) {
        console.error('달력 데이터 조회 실패:', error)
      }
    },

    clearProfile() {
      this.currentProfile = null
      this.achievements = []
      this.calendarData = []
      this.calendarPlans = []
      this.error = null
    }
  }
})
