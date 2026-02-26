import type { UserProgress } from '@/types/progress'
import type { DailySchedule } from '@/types/schedule'

export type CardType = 'login' | 'main' | 'pastIncomplete' | 'allDone'

export interface PastIncompleteData {
  schedule: DailySchedule
  date: string
}

export interface DetermineCardTypeInput {
  isAuthenticated: boolean
  todaySchedule: DailySchedule | null
  todayProgress: UserProgress | null
  pastIncomplete: PastIncompleteData | null
}

export function determineCardType(input: DetermineCardTypeInput): CardType {
  const { isAuthenticated, todaySchedule, todayProgress, pastIncomplete } = input

  if (!isAuthenticated) return 'login'

  if (!todaySchedule) {
    if (pastIncomplete) return 'pastIncomplete'
    return 'allDone'
  }

  if (todayProgress?.isCompleted) {
    if (pastIncomplete) return 'pastIncomplete'
    return 'allDone'
  }

  if (pastIncomplete) return 'pastIncomplete'
  return 'main'
}
