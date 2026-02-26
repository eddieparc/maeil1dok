import type { CatchupSession, CatchupSchedule, CatchupStatus } from '@/types'

export interface ICatchupRepository {
  createSession(data: Pick<CatchupSession, 'subscriptionId' | 'name' | 'rangeStart' | 'rangeEnd' | 'strategy'>): Promise<CatchupSession>
  getSessionsForSubscription(subscriptionId: string): Promise<CatchupSession[]>
  getSessionById(id: string): Promise<CatchupSession | null>
  updateSessionStatus(id: string, status: CatchupStatus): Promise<CatchupSession>
  getSchedulesForSession(sessionId: string): Promise<CatchupSchedule[]>
  markScheduleComplete(id: string): Promise<CatchupSchedule>
  markScheduleIncomplete(id: string): Promise<CatchupSchedule>
}
