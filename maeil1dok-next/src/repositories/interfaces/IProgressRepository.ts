import type { UserProgress, ProgressSummary } from '@/types'

export interface IProgressRepository {
  getProgress(subscriptionId: string, scheduleId: string): Promise<UserProgress | null>
  markComplete(subscriptionId: string, scheduleId: string): Promise<UserProgress>
  markIncomplete(subscriptionId: string, scheduleId: string): Promise<UserProgress>
  getProgressForSubscription(subscriptionId: string): Promise<UserProgress[]>
  getProgressSummary(subscriptionId: string): Promise<ProgressSummary>
  bulkGetProgress(subscriptionId: string, scheduleIds: string[]): Promise<UserProgress[]>
}
