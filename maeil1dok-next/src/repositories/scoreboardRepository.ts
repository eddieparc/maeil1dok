import type {
  ScoreboardData,
  ScoreboardEntry,
  ScoreboardPeriod,
  ScoreboardPeriodLeaderboard,
  ScoreboardPlan,
} from '@/types/scoreboard'

type StatsByPeriod = Record<ScoreboardPeriod, { completedDays: number; progressRate: number }>

interface BaseUserRanking {
  userId: string
  nickname: string
  avatarUrl: string | null
  isCurrentUser: boolean
  stats: StatsByPeriod
}

const PLANS: ScoreboardPlan[] = [
  { id: 'all', name: '전체 읽기표' },
  { id: 'plan-1', name: '1년 1독 플랜' },
  { id: 'plan-2', name: '신약 집중 플랜' },
]

const USER_DATA: Record<string, BaseUserRanking[]> = {
  all: [
    {
      userId: 'u-1',
      nickname: '다니엘',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 7, progressRate: 100 },
        month: { completedDays: 25, progressRate: 92 },
        all: { completedDays: 263, progressRate: 88 },
      },
    },
    {
      userId: 'u-2',
      nickname: '하은',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 6, progressRate: 85 },
        month: { completedDays: 24, progressRate: 89 },
        all: { completedDays: 251, progressRate: 84 },
      },
    },
    {
      userId: 'u-3',
      nickname: '요셉',
      avatarUrl: null,
      isCurrentUser: true,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 5, progressRate: 72 },
        month: { completedDays: 21, progressRate: 78 },
        all: { completedDays: 233, progressRate: 77 },
      },
    },
    {
      userId: 'u-4',
      nickname: '민수',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 0, progressRate: 0 },
        week: { completedDays: 4, progressRate: 58 },
        month: { completedDays: 18, progressRate: 66 },
        all: { completedDays: 210, progressRate: 69 },
      },
    },
    {
      userId: 'u-5',
      nickname: '예람',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 0, progressRate: 0 },
        week: { completedDays: 3, progressRate: 42 },
        month: { completedDays: 14, progressRate: 52 },
        all: { completedDays: 184, progressRate: 60 },
      },
    },
  ],
  'plan-1': [
    {
      userId: 'u-1',
      nickname: '다니엘',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 7, progressRate: 100 },
        month: { completedDays: 24, progressRate: 90 },
        all: { completedDays: 251, progressRate: 84 },
      },
    },
    {
      userId: 'u-3',
      nickname: '요셉',
      avatarUrl: null,
      isCurrentUser: true,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 5, progressRate: 72 },
        month: { completedDays: 20, progressRate: 76 },
        all: { completedDays: 220, progressRate: 74 },
      },
    },
    {
      userId: 'u-2',
      nickname: '하은',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 5, progressRate: 70 },
        month: { completedDays: 18, progressRate: 68 },
        all: { completedDays: 212, progressRate: 71 },
      },
    },
  ],
  'plan-2': [
    {
      userId: 'u-2',
      nickname: '하은',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 6, progressRate: 85 },
        month: { completedDays: 23, progressRate: 88 },
        all: { completedDays: 240, progressRate: 82 },
      },
    },
    {
      userId: 'u-6',
      nickname: '은혜',
      avatarUrl: null,
      isCurrentUser: false,
      stats: {
        today: { completedDays: 1, progressRate: 100 },
        week: { completedDays: 5, progressRate: 71 },
        month: { completedDays: 19, progressRate: 73 },
        all: { completedDays: 205, progressRate: 70 },
      },
    },
    {
      userId: 'u-3',
      nickname: '요셉',
      avatarUrl: null,
      isCurrentUser: true,
      stats: {
        today: { completedDays: 0, progressRate: 0 },
        week: { completedDays: 3, progressRate: 43 },
        month: { completedDays: 12, progressRate: 48 },
        all: { completedDays: 161, progressRate: 54 },
      },
    },
  ],
}

function toEntries(list: BaseUserRanking[], period: ScoreboardPeriod): ScoreboardEntry[] {
  return [...list]
    .sort((a, b) => {
      const byRate = b.stats[period].progressRate - a.stats[period].progressRate
      if (byRate !== 0) return byRate
      return b.stats[period].completedDays - a.stats[period].completedDays
    })
    .map((entry) => ({
      userId: entry.userId,
      nickname: entry.nickname,
      avatarUrl: entry.avatarUrl,
      completedDays: entry.stats[period].completedDays,
      progressRate: entry.stats[period].progressRate,
      isCurrentUser: entry.isCurrentUser,
    }))
}

function buildPeriodLeaderboard(entries: BaseUserRanking[]): ScoreboardPeriodLeaderboard {
  return {
    today: toEntries(entries, 'today'),
    week: toEntries(entries, 'week'),
    month: toEntries(entries, 'month'),
    all: toEntries(entries, 'all'),
  }
}

export async function getScoreboardData(): Promise<ScoreboardData> {
  const leaderboards = Object.fromEntries(
    PLANS.map((plan) => [plan.id, buildPeriodLeaderboard(USER_DATA[plan.id] ?? [])]),
  )

  return {
    plans: PLANS,
    leaderboards,
  }
}
