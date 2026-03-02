import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type SupabaseDB = SupabaseClient<Database>

type HighlightRow = Database['public']['Tables']['user_highlights']['Row']
type HighlightInsert = Database['public']['Tables']['user_highlights']['Insert']
type HighlightUpdate = Database['public']['Tables']['user_highlights']['Update']

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

export async function getChapterHighlights(
  supabase: SupabaseDB,
  userId: string,
  book: string,
  chapter: number,
  version: string
): RepositoryResult<HighlightRow[]> {
  const { data, error } = await supabase
    .from('user_highlights' as never)
    .select('*')
    .eq('user_id', userId)
    .eq('book', book)
    .eq('chapter', chapter)
    .eq('version', version)
    .order('verse_start', { ascending: true })

  return {
    data: data ?? [],
    error,
  }
}

export async function createHighlight(
  supabase: SupabaseDB,
  userId: string,
  input: Omit<HighlightInsert, 'user_id'>
): RepositoryResult<HighlightRow> {
  const payload: HighlightInsert = {
    ...input,
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('user_highlights' as never)
    .insert(payload as never)
    .select('*')
    .single()

  return {
    data,
    error,
  }
}

export async function updateHighlight(
  supabase: SupabaseDB,
  userId: string,
  highlightId: string,
  input: HighlightUpdate
): RepositoryResult<HighlightRow> {
  const { data, error } = await supabase
    .from('user_highlights' as never)
    .update({ ...input, updated_at: new Date().toISOString() } as never)
    .eq('id', highlightId)
    .eq('user_id', userId)
    .select('*')
    .single()

  return {
    data,
    error,
  }
}

export async function deleteHighlight(
  supabase: SupabaseDB,
  userId: string,
  highlightId: string
): RepositoryResult<{ success: boolean }> {
  const { error } = await supabase
    .from('user_highlights' as never)
    .delete()
    .eq('id', highlightId)
    .eq('user_id', userId)

  return {
    data: error ? null : { success: true },
    error,
  }
}
