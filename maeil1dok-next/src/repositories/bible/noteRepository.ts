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

type NoteTable = TableDef<
  'user_notes',
  {
    Row: {
      id: string
      user_id: string
      book: string
      chapter: number
      start_verse: number | null
      end_verse: number | null
      content: string
      is_private: boolean
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      book: string
      chapter: number
      start_verse?: number | null
      end_verse?: number | null
      content: string
      is_private?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      content?: string
      start_verse?: number | null
      end_verse?: number | null
      is_private?: boolean
      updated_at?: string
    }
  }
>

export type NoteRow = NoteTable['Row']
export type NoteInsert = NoteTable['Insert']
export type NoteUpdate = NoteTable['Update']

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

type NoteFilter = {
  book?: string
  chapter?: number
}

export async function getNotes(
  supabase: SupabaseDB,
  userId: string,
  filter?: NoteFilter
): RepositoryResult<NoteRow[]> {
  const query = supabase
    .from('user_notes' as never)
    .select('*')
    .eq('user_id', userId)

  if (filter?.book) {
    query.eq('book', filter.book)
  }
  if (filter?.chapter !== undefined) {
    query.eq('chapter', filter.chapter)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  return {
    data: (data as NoteRow[] | null) ?? [],
    error,
  }
}

export async function getNote(
  supabase: SupabaseDB,
  userId: string,
  noteId: string
): RepositoryResult<NoteRow> {
  const { data, error } = await supabase
    .from('user_notes' as never)
    .select('*')
    .eq('id', noteId)
    .eq('user_id', userId)
    .single()

  if (error?.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return {
    data: (data as NoteRow | null) ?? null,
    error,
  }
}

export async function createNote(
  supabase: SupabaseDB,
  userId: string,
  input: Omit<NoteInsert, 'user_id'>
): RepositoryResult<NoteRow> {
  const payload: NoteInsert = {
    ...input,
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('user_notes' as never)
    .insert(payload as never)
    .select('*')
    .single()

  return {
    data: (data as NoteRow | null) ?? null,
    error,
  }
}

export async function updateNote(
  supabase: SupabaseDB,
  userId: string,
  noteId: string,
  input: NoteUpdate
): RepositoryResult<NoteRow> {
  const { data, error } = await supabase
    .from('user_notes' as never)
    .update({ ...input, updated_at: new Date().toISOString() } as never)
    .eq('id', noteId)
    .eq('user_id', userId)
    .select('*')
    .single()

  return {
    data: (data as NoteRow | null) ?? null,
    error,
  }
}

export async function deleteNote(
  supabase: SupabaseDB,
  userId: string,
  noteId: string
): RepositoryResult<{ success: boolean }> {
  const { error } = await supabase
    .from('user_notes' as never)
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId)

  return {
    data: error ? null : { success: true },
    error,
  }
}
