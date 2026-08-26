import { defineStore } from 'pinia'
import { useApi } from '~/composables/useApi'
import type { components } from '~/types/generated/api-schema'

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

const normalizeReadingPlan = (plan: components['schemas']['BibleReadingPlan']): BibleReadingPlan => ({
  ...plan,
  description: plan.description ?? ''
})

const normalizeReadingGroup = (group: components['schemas']['ReadingGroupResponse']): ReadingGroup => ({
  ...group,
  creator: {
    ...group.creator,
    profile_image: group.creator.profile_image ?? undefined
  },
  plans: group.plans.map(normalizeReadingPlan),
  my_role: group.my_role ?? undefined
})

const normalizeGroupMember = (member: components['schemas']['GroupMember']): GroupMember => ({
  ...member,
  user: {
    ...member.user,
    profile_image: member.user.profile_image ?? undefined
  }
})

const normalizeSchedule = (
  schedule: components['schemas']['DailyBibleScheduleWithProgress']
): DailySchedule => ({
  ...schedule,
  audio_link: schedule.audio_link ?? undefined,
  guide_link: schedule.guide_link ?? undefined
})

const normalizeInvitation = (
  invitation: components['schemas']['GroupInvitation']
): GroupInvitation => ({
  ...invitation,
  group: normalizeReadingGroup(invitation.group),
  inviter: {
    ...invitation.inviter,
    profile_image: invitation.inviter.profile_image ?? undefined
  }
})

const normalizeCalendarDay = (day: components['schemas']['GroupProgressDay']): CalendarDayData => ({
  ...day,
  members: day.members.map(member => ({
    ...member,
    profile_image: member.profile_image ?? undefined
  }))
})

const getApiError = (response: unknown): any =>
  typeof response === 'object' && response !== null && 'error' in response
    ? response.error
    : undefined

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
        const api = useApi()
        const { data } = await api.GET('/api/v1/todos/groups/', {
          params: filters
        })

        if (data?.success) {
          // 중복 제거를 위해 Map 사용
          const uniqueGroups = new Map<number, ReadingGroup>()
          data.groups.map(normalizeReadingGroup).forEach(group => {
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
        const api = useApi()
        const { data } = await api.GET(
          api.path('/api/v1/todos/groups/{group_id}/', { group_id: groupId })
        )

        if (data?.success) {
          this.currentGroup = normalizeReadingGroup(data.group)
          return { success: true }
        } else {
          return { success: false, error: getApiError(data) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      } finally {
        this.isLoading = false
      }
    },

    async fetchGroupMembers(groupId: number) {
      try {
        const api = useApi()
        const { data } = await api.GET(
          api.path('/api/v1/todos/groups/{group_id}/members/', { group_id: groupId })
        )

        if (data?.success) {
          this.currentGroupMembers = data.members.map(normalizeGroupMember)
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
        const api = useApi()
        const response = await api.POST('/api/v1/todos/groups/create/', groupData)

        if (response?.success) {
          const group = normalizeReadingGroup(response.group)
          this.myGroups.push(group)
          return { success: true, data: group }
        } else {
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async joinGroup(groupId: number) {
      try {
        const api = useApi()
        const response = await api.POST(
          api.path('/api/v1/todos/groups/{group_id}/join/', { group_id: groupId })
        )

        if (response?.success) {
          // 그룹 정보 업데이트
          if (this.currentGroup?.id === groupId) {
            this.currentGroup.is_member = true
            this.currentGroup.member_count++
          }
          return { success: true }
        } else {
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async leaveGroup(groupId: number) {
      try {
        const api = useApi()
        const response = await api.POST(
          api.path('/api/v1/todos/groups/{group_id}/leave/', { group_id: groupId })
        )

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
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async inviteToGroup(groupId: number, userId: number, message: string = '') {
      try {
        const api = useApi()
        const response = await api.POST(
          api.path('/api/v1/todos/groups/{group_id}/invite/', { group_id: groupId }),
          {
            user_id: userId,
            message
          }
        )

        if (response?.success) {
          return { success: true }
        } else {
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async fetchInvitations() {
      try {
        const api = useApi()
        const { data } = await api.GET('/api/v1/todos/invitations/')

        if (data?.success) {
          this.invitations = data.invitations.map(normalizeInvitation)
        }
      } catch (error) {
        console.error('초대 목록 조회 실패:', error)
      }
    },

    async respondToInvitation(invitationId: number, action: 'accept' | 'decline') {
      try {
        const api = useApi()
        const response = await api.POST(
          api.path('/api/v1/todos/invitations/{invitation_id}/respond/', {
            invitation_id: invitationId
          }),
          { action }
        )

        if (response?.success) {
          // 초대 목록에서 제거
          this.invitations = this.invitations.filter(inv => inv.id !== invitationId)

          if (action === 'accept' && response.group) {
            // 내 그룹 목록에 추가
            this.myGroups.push(normalizeReadingGroup(response.group))
          }

          return { success: true }
        } else {
          return { success: false, error: getApiError(response) }
        }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    },

    async fetchGroupPlanSchedule(planId: number, month: number, year?: number) {
      try {
        const api = useApi()
        const currentYear = year || new Date().getFullYear()
        const { data } = await api.GET('/api/v1/todos/schedules/month/', {
          params: {
            plan_id: planId,
            month: month,
            year: currentYear
          }
        })

        if (data && Array.isArray(data)) {
          this.currentPlanSchedules = data.map(normalizeSchedule)
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
        const api = useApi()
        const currentYear = year || new Date().getFullYear()
        const params: Record<string, number> = { month, year: currentYear }
        if (planId) params.plan_id = planId

        const { data } = await api.GET(
          api.path('/api/v1/todos/groups/{group_id}/member-progress/', { group_id: groupId }),
          { params }
        )

        if (data?.success) {
          this.memberCalendarData = Object.fromEntries(
            Object.entries(data.calendar || {}).map(([date, day]) => [date, normalizeCalendarDay(day)])
          )
          this.memberCalendarPlan = data.plan || null
          this.memberCalendarMeta = data.meta || null
          return { success: true }
        } else {
          return { success: false, error: getApiError(data) }
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
        const api = useApi()
        const { data } = await api.GET(
          api.path('/api/v1/todos/users/{user_id}/groups/', { user_id: userId })
        )

        if (data?.success) {
          this.groups = data.groups.map(normalizeReadingGroup)
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
        const api = useApi()
        const response = await api.PATCH(
          api.path('/api/v1/todos/groups/{group_id}/visibility/', { group_id: groupId }),
          { show_in_profile: showInProfile }
        )

        if (response?.success) {
          // myGroups에서 해당 그룹 업데이트
          const group = this.myGroups.find(g => g.id === groupId)
          if (group) {
            group.show_in_profile = response.show_in_profile
          }
          return { success: true }
        } else {
          return { success: false, error: getApiError(response) }
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