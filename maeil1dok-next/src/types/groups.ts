export type GroupFilter = 'all' | 'public' | 'mine'

export type GroupStatus = 'active' | 'recruiting' | 'ended'

export interface GroupLeader {
  id: string
  nickname: string
  profileImage?: string | null
}

export interface GroupPlan {
  id: number
  name: string
}

export interface GroupMember {
  id: string
  nickname: string
  profileImage?: string | null
  role: '관리자' | '멤버'
  joinedAt: string
}

export interface GroupActivity {
  id: string
  message: string
  createdAt: string
}

export interface ReadingGroup {
  id: number
  name: string
  description: string
  status: GroupStatus
  isPublic: boolean
  isMine: boolean
  maxMembers: number
  memberCount: number
  leader: GroupLeader
  plans: GroupPlan[]
  members: GroupMember[]
  activities: GroupActivity[]
}
