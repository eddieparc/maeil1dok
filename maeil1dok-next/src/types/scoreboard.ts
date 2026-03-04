export type ScoreboardPeriod = 'today' | 'week' | 'month' | 'all'

export interface ScoreboardPlan {
  id: string
  name: string
}

export interface ScoreboardEntry {
  userId: string
  nickname: string
  avatarUrl: string | null
  completedDays: number
  progressRate: number
  isCurrentUser: boolean
}

export interface ScoreboardPeriodLeaderboard {
  today: ScoreboardEntry[]
  week: ScoreboardEntry[]
  month: ScoreboardEntry[]
  all: ScoreboardEntry[]
}

export interface ScoreboardData {
  plans: ScoreboardPlan[]
  leaderboards: Record<string, ScoreboardPeriodLeaderboard>
}
