import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { components } from '~/types/generated/api-schema'

interface User {
  id: number
  username: string
  nickname: string
  profile_image?: string
  is_following?: boolean
  total_completed_days?: number
}

interface Friend extends User {
  is_mutual: boolean
}

const getRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : undefined

const isApiUser = (value: unknown): value is components['schemas']['UserSearchResponseItem'] => {
  const user = getRecord(value)
  return user !== undefined &&
    typeof user.id === 'number' &&
    typeof user.username === 'string' &&
    typeof user.nickname === 'string' &&
    typeof user.is_following === 'boolean' &&
    typeof user.total_completed_days === 'number'
}

const getApiUsers = (value: unknown): components['schemas']['UserSearchResponseItem'][] | undefined =>
  Array.isArray(value) && value.every(isApiUser) ? value : undefined

const normalizeUser = (user: components['schemas']['UserSearchResponseItem']): User => ({
  ...user,
  profile_image: user.profile_image ?? undefined
})

const getApiError = (...responses: unknown[]): string | undefined => {
  for (const response of responses) {
    const error = getRecord(response)?.error
    if (typeof error === 'string') return error
  }
  return undefined
}

export const useSocialStore = defineStore('social', {
  state: () => ({
    followers: [] as User[],
    following: [] as User[],
    friends: [] as Friend[],
    searchResults: [] as User[],
    isLoading: false,
    error: null as string | null
  }),

  getters: {
    followersCount: (state) => state.followers.length,
    followingCount: (state) => state.following.length,
    friendsCount: (state) => state.friends.length,
    
    isFollowing: (state) => (userId: number) => {
      return state.following.some(user => user.id === userId)
    },
    
    isFriend: (state) => (userId: number) => {
      return state.friends.some(friend => friend.id === userId)
    }
  },

  actions: {
    async fetchFollowers(userId: number) {
      this.isLoading = true
      this.error = null
      try {
        const api = useApi()
        const response = await api.GET(
          api.path('/api/v1/auth/followers/{user_id}/', { user_id: userId })
        )
        if (response.data?.success) {
          // 하위 호환: response.data.data?.followers 또는 response.data.followers
          const followers = response.data.data?.followers ??
            getApiUsers(getRecord(response.data)?.followers) ?? []
          this.followers = followers.map(normalizeUser)
        } else {
          this.error = getApiError(response.data) || '팔로워를 불러올 수 없습니다.'
        }
      } catch (error: any) {
        console.error('팔로워 조회 실패:', error)
        this.error = error.message || '팔로워를 불러올 수 없습니다.'
      } finally {
        this.isLoading = false
      }
    },

    async fetchFollowing(userId: number) {
      this.isLoading = true
      this.error = null
      try {
        const api = useApi()
        const response = await api.GET(
          api.path('/api/v1/auth/following/{user_id}/', { user_id: userId })
        )
        if (response.data?.success) {
          // 하위 호환: response.data.data?.following 또는 response.data.following
          const following = response.data.data?.following ??
            getApiUsers(getRecord(response.data)?.following) ?? []
          this.following = following.map(normalizeUser)
        } else {
          this.error = getApiError(response.data) || '팔로잉 목록을 불러올 수 없습니다.'
        }
      } catch (error: any) {
        console.error('팔로잉 조회 실패:', error)
        this.error = error.message || '팔로잉 목록을 불러올 수 없습니다.'
      } finally {
        this.isLoading = false
      }
    },

    async fetchFriends() {
      this.isLoading = true
      this.error = null
      try {
        const api = useApi()
        const response = await api.GET('/api/v1/auth/friends/')
        if (response.data?.success) {
          const friendsData = response.data.data?.friends ||
            getApiUsers(getRecord(response.data)?.friends) || []
          this.friends = friendsData.map(friend => ({
            ...normalizeUser(friend),
            is_mutual: true
          }))
        } else {
          this.error = getApiError(response.data) || '친구 목록을 불러올 수 없습니다.'
        }
      } catch (error: any) {
        console.error('친구 목록 조회 실패:', error)
        this.error = error.message || '친구 목록을 불러올 수 없습니다.'
      } finally {
        this.isLoading = false
      }
    },

    // 모든 목록에서 사용자의 is_following 상태 업데이트
    updateUserFollowStatus(userId: number, isFollowing: boolean) {
      // 팔로워 목록 업데이트
      this.followers = this.followers.map(user =>
        user.id === userId ? { ...user, is_following: isFollowing } : user
      )
      // 검색 결과 업데이트
      this.searchResults = this.searchResults.map(user =>
        user.id === userId ? { ...user, is_following: isFollowing } : user
      )
    },

    async followUser(userId: number, userInfo?: Partial<User>) {
      try {
        const api = useApi()
        const response = await api.POST('/api/v1/auth/follow/', {
          user_id: userId
        })
        const legacyResponse = getRecord(response.data)

        if (response?.success || legacyResponse?.success) {
          // 낙관적 업데이트: 팔로잉 목록에 추가
          if (userInfo && !this.following.some(u => u.id === userId)) {
            this.following.push({
              id: userId,
              username: userInfo.username || '',
              nickname: userInfo.nickname || '',
              profile_image: userInfo.profile_image,
              is_following: true,
              total_completed_days: userInfo.total_completed_days
            })
          }
          // 모든 목록에서 is_following 상태 업데이트
          this.updateUserFollowStatus(userId, true)
          return { success: true }
        } else {
          return {
            success: false,
            error: getApiError(response, response.data) || '팔로우에 실패했습니다.'
          }
        }
      } catch (error: any) {
        return { success: false, error: error.message || '팔로우에 실패했습니다.' }
      }
    },

    async unfollowUser(userId: number) {
      try {
        const api = useApi()
        const response = await api.DELETE(
          api.path('/api/v1/auth/unfollow/{user_id}/', { user_id: userId })
        )
        const legacyResponse = getRecord(response.data)

        if (response?.success || legacyResponse?.success) {
          // 팔로잉 목록에서 제거
          this.following = this.following.filter(user => user.id !== userId)
          // 친구 목록에서도 제거 (상호 팔로우가 깨짐)
          this.friends = this.friends.filter(friend => friend.id !== userId)
          // 모든 목록에서 is_following 상태 업데이트
          this.updateUserFollowStatus(userId, false)
          return { success: true }
        } else {
          return {
            success: false,
            error: getApiError(response, response.data) || '언팔로우에 실패했습니다.'
          }
        }
      } catch (error: any) {
        return { success: false, error: error.message || '언팔로우에 실패했습니다.' }
      }
    },

    async searchUsers(query: string) {
      if (query.length < 2) {
        this.searchResults = []
        return
      }

      this.isLoading = true
      this.error = null
      try {
        const api = useApi()
        const response = await api.GET('/api/v1/auth/search/', {
          params: { q: query }
        })

        if (response.data?.success) {
          // 하위 호환: response.data.data?.users 또는 response.data.users
          const users = response.data.data?.users ??
            getApiUsers(getRecord(response.data)?.users) ?? []
          this.searchResults = users.map(normalizeUser)
        } else {
          this.searchResults = []
        }
      } catch (error: any) {
        console.error('사용자 검색 실패:', error)
        this.searchResults = []
      } finally {
        this.isLoading = false
      }
    },

    clearSearchResults() {
      this.searchResults = []
    },

    clearSocialData() {
      this.followers = []
      this.following = []
      this.friends = []
      this.searchResults = []
      this.error = null
    }
  }
})