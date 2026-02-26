export interface HasenaRecord {
  id: string
  userId: string
  date: string
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface HasenaSummary {
  id: string
  videoId: string
  videoDate: string | null
  title: string
  summary: string
  transcript: string
  modelUsed: string
  isEdited: boolean
  createdAt: string
  updatedAt: string
}

export interface VideoBibleIntro {
  id: string
  planId: number
  book: string
  urlLink: string
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
}

export interface VideoIntroProgress {
  id: string
  userId: string
  videoIntroId: string
  isCompleted: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}
