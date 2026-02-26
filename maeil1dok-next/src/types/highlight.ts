export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface VerseHighlight {
  id: string
  userId: string
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  color: HighlightColor
  version: string
  createdAt: string
  updatedAt: string
}

export interface CreateHighlightInput {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  color: HighlightColor
  version: string
}
