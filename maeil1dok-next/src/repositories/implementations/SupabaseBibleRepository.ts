import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IBibleRepository } from '@/repositories/interfaces/IBibleRepository'
import type { BibleContent } from '@/types'
import { NetworkError } from '@/repositories/types/errors'

type DBBibleCache = Database['public']['Tables']['bible_content_cache']['Row']

function mapBibleContent(row: DBBibleCache): BibleContent {
  return {
    id: row.id,
    book: row.book,
    chapter: row.chapter,
    language: row.language,
    version: row.version,
    content: row.content as Record<string, unknown>,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabaseBibleRepository implements IBibleRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getBibleText(
    book: string,
    chapter: number,
    language: string,
    version: string
  ): Promise<BibleContent | null> {
    const { data, error } = await this.supabase
      .from('bible_content_cache')
      .select('*')
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('language', language)
      .eq('version', version)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapBibleContent(data) : null
  }

  async cacheBibleText(
    book: string,
    chapter: number,
    language: string,
    version: string,
    content: Record<string, unknown>
  ): Promise<void> {
    const { error } = await (this.supabase
      .from('bible_content_cache') as any)
      .upsert({
        book,
        chapter,
        language,
        version,
        content,
      }, { onConflict: 'book,chapter,language,version' })
    
    if (error) throw new NetworkError(error.message, error)
  }

  async getAvailableLanguages(): Promise<string[]> {
    const { data, error } = await (this.supabase
      .from('bible_content_cache') as any)
      .select('language')
    
    if (error) throw new NetworkError(error.message, error)
    const unique = [...new Set((data ?? []).map((d: any) => d.language))] as string[]
    return unique
  }

  async getAvailableVersions(language: string): Promise<string[]> {
    const { data, error } = await (this.supabase
      .from('bible_content_cache') as any)
      .select('version')
      .eq('language', language)
    
    if (error) throw new NetworkError(error.message, error)
    const unique = [...new Set((data ?? []).map((d: any) => d.version))] as string[]
    return unique
  }
}
