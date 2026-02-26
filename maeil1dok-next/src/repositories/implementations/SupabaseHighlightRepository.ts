import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IHighlightRepository } from '@/repositories/interfaces/IHighlightRepository'
import type { VerseHighlight, HighlightColor, CreateHighlightInput } from '@/types'
import { AuthError, NetworkError, NotFoundError } from '@/repositories/types/errors'

function mapHighlight(row: any): VerseHighlight {
  return {
    id: row.id,
    userId: row.user_id,
    book: row.book,
    chapter: row.chapter,
    verseStart: row.verse_start,
    verseEnd: row.verse_end,
    color: row.color as HighlightColor,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabaseHighlightRepository implements IHighlightRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new AuthError('Not authenticated')
    return user.id
  }

  async getHighlights(book: string, chapter: number, version: string): Promise<VerseHighlight[]> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await (this.supabase.from('user_highlights') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('version', version)

    if (error) throw new NetworkError(error.message, error)
    return (data || []).map(mapHighlight)
  }

  async createHighlight(input: CreateHighlightInput): Promise<VerseHighlight> {
    const userId = await this.getCurrentUserId()

    const { data, error } = await (this.supabase.from('user_highlights') as any)
      .upsert({
        user_id: userId,
        book: input.book,
        chapter: input.chapter,
        verse_start: input.verseStart,
        verse_end: input.verseEnd,
        color: input.color,
        version: input.version,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,book,chapter,verse_start,verse_end,version' })
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to create highlight')
    return mapHighlight(data)
  }

  async deleteHighlight(highlightId: string): Promise<void> {
    const userId = await this.getCurrentUserId()

    const { error } = await (this.supabase.from('user_highlights') as any)
      .delete()
      .eq('id', highlightId)
      .eq('user_id', userId)

    if (error) throw new NetworkError(error.message, error)
  }

  async updateHighlightColor(highlightId: string, color: HighlightColor): Promise<VerseHighlight> {
    const userId = await this.getCurrentUserId()

    const { data, error } = await (this.supabase.from('user_highlights') as any)
      .update({ color, updated_at: new Date().toISOString() })
      .eq('id', highlightId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NotFoundError('Highlight not found')
    return mapHighlight(data)
  }
}
