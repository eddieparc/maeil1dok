export interface UserProgress {
  id: string
  subscriptionId: string
  scheduleId: string
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProgressSummary {
  totalDays: number
  completedDays: number
  currentStreak: number
  longestStreak: number
}
