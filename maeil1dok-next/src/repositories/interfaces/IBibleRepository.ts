import type { BibleContent } from '@/types'

export interface IBibleRepository {
  /**
   * Get Bible text. Uses language + version composite (e.g., language='ko', version='GAE')
   */
  getBibleText(book: string, chapter: number, language: string, version: string): Promise<BibleContent | null>
  cacheBibleText(book: string, chapter: number, language: string, version: string, content: Record<string, unknown>): Promise<void>
  getAvailableLanguages(): Promise<string[]>
  getAvailableVersions(language: string): Promise<string[]>
}
