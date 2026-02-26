import type { VerseHighlight, HighlightColor, CreateHighlightInput } from '@/types'

export interface IHighlightRepository {
  getHighlights(book: string, chapter: number, version: string): Promise<VerseHighlight[]>
  createHighlight(input: CreateHighlightInput): Promise<VerseHighlight>
  deleteHighlight(highlightId: string): Promise<void>
  updateHighlightColor(highlightId: string, color: HighlightColor): Promise<VerseHighlight>
}
