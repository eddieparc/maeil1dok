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

type BookmarkTable = TableDef<
  'user_bookmarks',
  {
    Row: {
      id: string
      user_id: string
      book: string
      chapter: number
      verse: number | null
      bookmark_type: 'chapter' | 'verse'
      title: string | null
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      user_id: string
      book: string
      chapter: number
      verse?: number | null
      bookmark_type?: 'chapter' | 'verse'
      title?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      title?: string | null
      updated_at?: string
    }
  }
>

export type BookmarkRow = BookmarkTable['Row']
export type BookmarkInsert = BookmarkTable['Insert']

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

type ToggleBookmarkInput = {
  book: string
  chapter: number
  verse?: number | null
  bookmark_type?: 'chapter' | 'verse'
  title?: string | null
}

export async function getBookmarks(
  supabase: SupabaseDB,
  userId: string,
  book?: string
): RepositoryResult<BookmarkRow[]> {
  const query = supabase
    .from('user_bookmarks' as never)
    .select('*')
    .eq('user_id', userId)

  if (book) {
    query.eq('book', book)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  return {
    data: (data as BookmarkRow[] | null) ?? [],
    error,
  }
}

export async function isBookmarked(
  supabase: SupabaseDB,
  userId: string,
  book: string,
  chapter: number,
  verse?: number | null
): RepositoryResult<boolean> {
  const query = supabase
    .from('user_bookmarks' as never)
    .select('id')
    .eq('user_id', userId)
    .eq('book', book)
    .eq('chapter', chapter)

  if (verse !== undefined && verse !== null) {
    query.eq('verse', verse)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { data: null, error }
  }

  return { data: !!data, error: null }
}

export async function toggleBookmark(
  supabase: SupabaseDB,
  userId: string,
  input: ToggleBookmarkInput
): RepositoryResult<{ bookmarked: boolean }> {
  let existingQuery = supabase
    .from('user_bookmarks' as never)
    .select('id')
    .eq('user_id', userId)
    .eq('book', input.book)
    .eq('chapter', input.chapter)

  if (input.verse !== undefined && input.verse !== null) {
    existingQuery = existingQuery.eq('verse', input.verse)
  } else {
    existingQuery = existingQuery.is('verse', null)
  }

  const existing = (await existingQuery.maybeSingle()) as {
    data: { id: string } | null
    error: Error | null
  }

  if (existing.error) {
    return { data: null, error: existing.error }
  }

  const existingBookmark = existing.data as { id: string } | null

  if (existingBookmark?.id) {
    const deleteQuery = supabase
      .from('user_bookmarks' as never)
      .delete() as unknown as {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => Promise<{ error: Error | null }>
      }
    }

    const { error } = await deleteQuery.eq('id', existingBookmark.id).eq('user_id', userId)

    return {
      data: error ? null : { bookmarked: false },
      error,
    }
  }

  const payload: BookmarkInsert = {
    user_id: userId,
    book: input.book,
    chapter: input.chapter,
    verse: input.verse ?? null,
    bookmark_type: input.bookmark_type ?? 'chapter',
    title: input.title ?? null,
  }

  const { error } = await supabase.from('user_bookmarks' as never).insert(payload as never)
  return {
    data: error ? null : { bookmarked: true },
    error,
  }
}
