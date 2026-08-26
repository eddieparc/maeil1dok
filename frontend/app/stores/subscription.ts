import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import { useAuthService } from '~/composables/useAuthService'

interface Subscription {
  id: number
  plan_id: number
  plan_name: string
  start_date: string
  is_active?: boolean
  is_default: boolean
}

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    subscriptions: [] as Subscription[],
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    activeSubscriptions: (state) => state.subscriptions.filter(sub => sub.is_active),
    defaultSubscription: (state) => state.subscriptions.find(sub => sub.is_default),
    hasMultipleSubscriptions: (state) => state.subscriptions.length > 1,
  },

  actions: {
    async fetchSubscriptions() {
      // 인증되지 않은 사용자는 API 호출하지 않음 (401 방지)
      const auth = useAuthService()
      if (!auth.isAuthenticated.value) {
        this.subscriptions = []
        return
      }

      const api = useApi()
      this.isLoading = true
      this.error = null

      try {
        const response = await api.GET('/api/v1/todos/plans/user/')
        this.subscriptions = response.data.subscriptions || []
      } catch (error) {
        this.error = '구독 정보를 불러오는데 실패했습니다'
        this.subscriptions = []
      } finally {
        this.isLoading = false
      }
    },

    async toggleSubscriptionActive(subscriptionId: number) {
      const api = useApi()
      
      try {
        const response = await api.POST(
          api.path('/api/v1/todos/plan/{id}/toggle-active/', { id: subscriptionId })
        )
        
        // 상태 업데이트
        const subscription = this.subscriptions.find(sub => sub.id === subscriptionId)
        if (subscription) {
          subscription.is_active = response.is_active
        }

        return response
      } catch (error) {
        throw error
      }
    },

    async subscribeToNewPlan(planId: number) {
      const api = useApi()
      
      try {
        const response = await api.POST('/api/v1/todos/plan/', {
          plan: planId
        })
        
        // 새로운 구독 정보 추가
        await this.fetchSubscriptions()
        
        return response
      } catch (error) {
        throw error
      }
    },

    // 구독 정보 초기화 (로그아웃 시 사용)
    clearSubscriptions() {
      this.subscriptions = []
      this.error = null
    }
  }
}) 