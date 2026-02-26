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
