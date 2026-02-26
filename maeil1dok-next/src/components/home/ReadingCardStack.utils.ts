import type { UserProgress } from '@/types/progress'
import type { DailySchedule } from '@/types/schedule'

export type CardType = 'login' | 'main' | 'pastIncomplete' | 'hasena' | 'intro' | 'allDone'

export interface PastIncompleteData {
  schedule: DailySchedule
  date: string
}

export interface DetermineCardTypeInput {
  isAuthenticated: boolean
  todaySchedule: DailySchedule | null
  todayProgress: UserProgress | null
  pastIncomplete: PastIncompleteData | null
  hasenaCompleted?: boolean
  introAvailable?: boolean
  introCompleted?: boolean
}

export function determineCardType(input: DetermineCardTypeInput): CardType {
  const { isAuthenticated, todaySchedule, todayProgress, pastIncomplete, hasenaCompleted, introAvailable, introCompleted } = input

  if (!isAuthenticated) return 'login'

  if (!todaySchedule) {
    if (pastIncomplete) return 'pastIncomplete'
    if (hasenaCompleted === false) return 'hasena'
    if (introAvailable && !introCompleted) return 'intro'
    return 'allDone'
  }

  if (todayProgress?.isCompleted) {
    if (pastIncomplete) return 'pastIncomplete'
    if (hasenaCompleted === false) return 'hasena'
    if (introAvailable && !introCompleted) return 'intro'
    return 'allDone'
  }

  if (pastIncomplete) return 'pastIncomplete'
  if (hasenaCompleted === false) return 'hasena'
  if (introAvailable && !introCompleted) return 'intro'
  return 'main'
}
