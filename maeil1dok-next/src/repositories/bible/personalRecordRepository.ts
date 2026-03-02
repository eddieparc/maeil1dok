import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type SupabaseDB = SupabaseClient<Database>
type PublicTables = Database['public']['Tables']
type TableShape = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
}

type TableDef<Name extends string, Fallback extends TableShape> =
  Name extends keyof PublicTables ? PublicTables[Name] : Fallback

type PersonalRecordTable = TableDef<
  'user_bible_progress',
  {
    Row: {
      id: string
      user_id: string
      book: string
      chapter: number
      read_at: string
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      book: string
      chapter: number
      read_at?: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      read_at?: string
      updated_at?: string
    }
  }
>

type PersonalRecordInsert = PersonalRecordTable['Insert']

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

export async function getReadChapters(
  supabase: SupabaseDB,
  userId: string,
  book: string
): RepositoryResult<number[]> {
  const { data, error } = await supabase
    .from('user_bible_progress' as never)
    .select('chapter')
    .eq('user_id', userId)
    .eq('book', book)
    .order('chapter', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  const chapters = ((data as Array<{ chapter: number }> | null) ?? []).map((item) => item.chapter)
  const uniqueSorted = [...new Set(chapters)].sort((a, b) => a - b)

  return {
    data: uniqueSorted,
    error: null,
  }
}

export async function markAsRead(
  supabase: SupabaseDB,
  userId: string,
  book: string,
  chapter: number
): RepositoryResult<{ success: boolean }> {
  const payload: PersonalRecordInsert = {
    user_id: userId,
    book,
    chapter,
    read_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_bible_progress' as never)
    .upsert(payload as never, { onConflict: 'user_id,book,chapter' })

  return {
    data: error ? null : { success: true },
    error,
  }
}

export async function getBookProgress(
  supabase: SupabaseDB,
  userId: string,
  book: string,
  totalChapters: number
): RepositoryResult<{ read: number; total: number; percentage: number }> {
  const readResult = await getReadChapters(supabase, userId, book)
  if (readResult.error) {
    return { data: null, error: readResult.error }
  }

  const read = readResult.data?.length ?? 0
  const total = totalChapters
  const percentage = total > 0 ? Math.round((read / total) * 100) : 0

  return {
    data: { read, total, percentage },
    error: null,
  }
}
