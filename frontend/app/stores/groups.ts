import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'

interface BibleReadingPlan {
  id: number
  name: string
  description: string
  is_default?: boolean
  is_active?: boolean
}

interface ReadingGroup {
  id: number
  name: string
  description: string
  creator: {
    id: number
    nickname: string
    profile_image?: string
  }
  plans: BibleReadingPlan[]
  is_public: boolean
  max_members: number
  member_count: number
  is_full: boolean
  is_member?: boolean
  my_role?: string
  show_in_profile?: boolean
  created_at: string
  updated_at: string
}

interface GroupMember {
  user: {
    id: number
    nickname: string
    profile_image?: string
  }
  role: string
  joined_at: string
}

interface DailySchedule {
  id: number
  plan: number
  plan_name: string
  date: string
  book: string
  start_chapter: number
  end_chapter: number
  audio_link?: string
  guide_link?: string
  is_completed?: boolean
}

interface GroupInvitation {
  id: number
  group: ReadingGroup
  inviter: {
    id: number
    nickname: string
    profile_image?: string
  }
  message: string
  created_at: string
}

interface MemberProgress {
  id: number
  nickname: string
  profile_image?: string
  is_completed: boolean
}

interface CalendarDayData {
  schedule: {
    book: string
    start_chapter: number
    end_chapter: number
  }
  total_members: number
  completed_count: number
  members: MemberProgress[]
}

interface GroupCalendarData {
  [date: string]: CalendarDayData
}

export const useGroupsStore = defineStore('groups', {
  state: () => ({
    groups: [] as ReadingGroup[],
    myGroups: [] as ReadingGroup[],
    currentGroup: null as ReadingGroup | null,
    currentGroupMembers: [] as GroupMember[],
    currentPlanSchedules: [] as DailySchedule[],
    memberCalendarData: {} as GroupCalendarData,
    memberCalendarPlan: null as { id: number; name: string } | null,
    memberCalendarMeta: null as { year: number; month: number; total_members: number } | null,
    invitations: [] as GroupInvitation[],
    isLoading: false,
    isMemberCalendarLoading: false,
    error: null as string | null
  }),

  getters: {
    publicGroups: (state) => state.groups.filter(g => g.is_public),
    memberGroups: (state) => state.myGroups.filter(g => g.is_member),
    adminGroups: (state) => state.myGroups.filter(g => g.my_role === '관리자'),
    pendingInvitations: (state) => state.invitations.length
  },

  actions: {
    async fetchGroups(filters: {
      search?: string
      plan_id?: number
      only_public?: boolean
      only_mine?: boolean
    } = {}) {
      this.isLoading = true
      this.error = null

      try {
        const { data } = await useApi().get('/api/v1/todos/groups/', {
          params: filters
        })

        if (data?.success) {
          // 중복 제거를 위해 Map 사용
          const uniqueGroups = new Map()
          data.groups.forEach((group: ReadingGroup) => {
            uniqueGroups.set(group.id, group)
          })
          const deduplicatedGroups = Array.from(uniqueGroups.values())

          if (filters.only_mine) {
            this.myGroups = deduplicatedGroups
          } else {
            this.groups = deduplicatedGroups
          }
        }
      } catch (error: any) {
        this.error = error.message || '그룹 목록을 불러올 수 없습니다.'
      } finally {
        this.isLoading = false
      }
    },

    async fetchGroupDetail(groupId: number) {
      this.isLoading = true

      try {
        const { data } = await useApi().get(`/api/v1/todos/groups/${groupId}/`)

        if (data?.success) {
          this.currentGroup = data.group
          return { success: true }
        } else {
          return { success: false, error: data?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      } finally {
        this.isLoading = false
      }
    },

    async fetchGroupMembers(groupId: number) {
      try {
        const { data } = await useApi().get(`/api/v1/todos/groups/${groupId}/members/`)

        if (data?.success) {
          this.currentGroupMembers = data.members
        }
      } catch (error) {
        console.error('그룹 멤버 조회 실패:', error)
      }
    },

    async createGroup(groupData: {
      name: string
      description: string
      plan_ids: number[]
      is_public: boolean
      max_members: number
    }) {
      try {
        const response = await useApi().post('/api/v1/todos/groups/create/', groupData)

        if (response?.success) {
          this.myGroups.push(response.group)
          return { success: true, data: response.group }
        } else {
          return { success: false, error: response?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async joinGroup(groupId: number) {
      try {
        const response = await useApi().post(`/api/v1/todos/groups/${groupId}/join/`)

        if (response?.success) {
          // 그룹 정보 업데이트
          if (this.currentGroup?.id === groupId) {
            this.currentGroup.is_member = true
            this.currentGroup.member_count++
          }
          return { success: true }
        } else {
          return { success: false, error: response?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async leaveGroup(groupId: number) {
      try {
        const response = await useApi().post(`/api/v1/todos/groups/${groupId}/leave/`)

        if (response?.success) {
          // 그룹 정보 업데이트
          if (this.currentGroup?.id === groupId) {
            this.currentGroup.is_member = false
            this.currentGroup.member_count--
          }
          // 내 그룹 목록에서 제거
          this.myGroups = this.myGroups.filter(g => g.id !== groupId)
          return { success: true }
        } else {
          return { success: false, error: response?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async inviteToGroup(groupId: number, userId: number, message: string = '') {
      try {
        const response = await useApi().post(`/api/v1/todos/groups/${groupId}/invite/`, {
          user_id: userId,
          message
        })

        if (response?.success) {
          return { success: true }
        } else {
          return { success: false, error: response?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async fetchInvitations() {
      try {
        const { data } = await useApi().get('/api/v1/todos/invitations/')

        if (data?.success) {
          this.invitations = data.invitations
        }
      } catch (error) {
        console.error('초대 목록 조회 실패:', error)
      }
    },

    async respondToInvitation(invitationId: number, action: 'accept' | 'decline') {
      try {
        const response = await useApi().post(`/api/v1/todos/invitations/${invitationId}/respond/`, {
          action
        })

        if (response?.success) {
          // 초대 목록에서 제거
          this.invitations = this.invitations.filter(inv => inv.id !== invitationId)

          if (action === 'accept' && response.group) {
            // 내 그룹 목록에 추가
            this.myGroups.push(response.group)
          }

          return { success: true }
        } else {
          return { success: false, error: response?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async fetchGroupPlanSchedule(planId: number, month: number, year?: number) {
      try {
        const currentYear = year || new Date().getFullYear()
        const { data } = await useApi().get('/api/v1/todos/schedules/month/', {
          params: {
            plan_id: planId,
            month: month,
            year: currentYear
          }
        })

        if (data && Array.isArray(data)) {
          this.currentPlanSchedules = data
          return { success: true }
        } else {
          return { success: false, error: '일정을 불러올 수 없습니다.' }
        }
      } catch (error: any) {
        return { success: false, error: error.message || '일정을 불러올 수 없습니다.' }
      }
    },

    async fetchGroupMemberProgress(groupId: number, month: number, year?: number, planId?: number) {
      this.isMemberCalendarLoading = true

      try {
        const currentYear = year || new Date().getFullYear()
        const params: Record<string, number> = { month, year: currentYear }
        if (planId) params.plan_id = planId

        const { data } = await useApi().get(`/api/v1/todos/groups/${groupId}/member-progress/`, {
          params
        })

        if (data?.success) {
          this.memberCalendarData = data.calendar || {}
          this.memberCalendarPlan = data.plan || null
          this.memberCalendarMeta = data.meta || null
          return { success: true }
        } else {
          return { success: false, error: data?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message || '멤버 진도를 불러올 수 없습니다.' }
      } finally {
        this.isMemberCalendarLoading = false
      }
    },

    // 타인의 공개 그룹 조회
    async fetchUserPublicGroups(userId: number) {
      this.isLoading = true
      this.error = null

      try {
        const { data } = await useApi().get(`/api/v1/todos/users/${userId}/groups/`)

        if (data?.success) {
          this.groups = data.groups
        }
      } catch (error: any) {
        this.error = error.message || '그룹 목록을 불러올 수 없습니다.'
      } finally {
        this.isLoading = false
      }
    },

    // 그룹 프로필 표시 설정
    async updateGroupVisibility(groupId: number, showInProfile: boolean) {
      try {
        const response = await useApi().patch(`/api/v1/todos/groups/${groupId}/visibility/`, {
          show_in_profile: showInProfile
        })

        if (response?.success) {
          // myGroups에서 해당 그룹 업데이트
          const group = this.myGroups.find(g => g.id === groupId)
          if (group) {
            group.show_in_profile = response.show_in_profile
          }
          return { success: true }
        } else {
          return { success: false, error: response?.error }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    clearGroupData() {
      this.groups = []
      this.myGroups = []
      this.currentGroup = null
      this.currentGroupMembers = []
      this.currentPlanSchedules = []
      this.memberCalendarData = {}
      this.memberCalendarPlan = null
      this.memberCalendarMeta = null
      this.invitations = []
      this.error = null
    }
  }
})