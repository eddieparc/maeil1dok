export interface DailySchedule {
  id: string
  planId: number
  date: string
  book: string
  startChapter: number
  endChapter: number
  audioLink: string | null
  guideLink: string | null
  createdAt: string
}

export interface BibleReadingPlan {
  id: number
  name: string
  description: string
  isDefault: boolean
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}
