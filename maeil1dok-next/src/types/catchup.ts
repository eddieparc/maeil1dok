export type CatchupStrategy = 'parallel' | 'sequential'
export type CatchupStatus = 'active' | 'completed' | 'abandoned'

export interface CatchupSession {
  id: string
  subscriptionId: string
  name: string
  rangeStart: string
  rangeEnd: string
  strategy: CatchupStrategy
  targetRejoinDate: string | null
  maxDailyReadings: number | null
  maxDailyChapters: number | null
  weekendMultiplier: number
  status: CatchupStatus
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CatchupSchedule {
  id: string
  sessionId: string
  originalScheduleId: string | null
  scheduledDate: string
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
