export interface UserProfile {
  userId: string
  nickname: string
  bio: string
  totalCompletedDays: number
  currentStreak: number
  longestStreak: number
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface UserReadingSettings {
  id: string
  userId: string
  theme: 'light' | 'dark' | 'system'
  fontFamily: string
  fontSize: number
  fontWeight: string
  lineHeight: number
  textAlign: string
  verseJoining: boolean
  showVerseNumbers: boolean
  showDescription: boolean
  showCrossRef: boolean
  highlightNames: boolean
  showFootnotes: boolean
  tongdokAutoComplete: boolean
  createdAt: string
  updatedAt: string
}

export interface UserReadingPosition {
  id: string
  userId: string
  book: string
  chapter: number
  verse: number | null
  scrollPosition: number
  version: string
  updatedAt: string
}
