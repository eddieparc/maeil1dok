export interface BibleContent {
  id: string
  book: string
  chapter: number
  language: string   // e.g., 'ko'
  version: string    // e.g., 'GAE', 'KNT', 'HAN', 'SAE', 'SAENEW', 'COG', 'COGNEW'
  content: Record<string, unknown>  // JSONB
  source: string | null
  createdAt: string
  updatedAt: string
}

/**
 * View mode for Bible reader
 */
export type ViewMode = 'home' | 'toc' | 'reader'

/**
 * Chapter suffix type (시편 uses '편', others use '장')
 */
export type ChapterSuffix = '장' | '편'

/**
 * Book information for search results
 */
export interface BookInfo {
  id: string
  ko: string
  chapters: number
  chosung: string
}

/**
 * Verse selection range
 */
export interface VerseSelectionRange {
  book: string
  chapter: number
  verse?: number
}
