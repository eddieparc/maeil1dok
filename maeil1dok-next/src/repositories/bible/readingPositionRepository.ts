import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type SupabaseDB = SupabaseClient<Database>

type ReadingPositionRow = Database['public']['Tables']['user_reading_positions']['Row']
type ReadingPositionInsert = Database['public']['Tables']['user_reading_positions']['Insert']

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

export async function getPosition(
  supabase: SupabaseDB,
  userId: string
): RepositoryResult<ReadingPositionRow> {
  const { data, error } = await supabase
    .from('user_reading_positions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error?.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return { data, error }
}

export async function savePosition(
  supabase: SupabaseDB,
  userId: string,
  input: Partial<Omit<ReadingPositionInsert, 'user_id'>>
): RepositoryResult<ReadingPositionRow> {
  const payload: ReadingPositionInsert = {
    user_id: userId,
    book: input.book ?? 'gen',
    chapter: input.chapter ?? 1,
    verse: input.verse ?? null,
    scroll_position: input.scroll_position ?? 0,
    version: input.version ?? 'GAE',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('user_reading_positions')
    .upsert(payload as never, { onConflict: 'user_id' })
    .select('*')
    .single()

  return { data, error }
}
