import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type BookmarkInsert = Database['public']['Tables']['bible_bookmarks']['Insert']

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const book = searchParams.get('book')
    const chapterParam = searchParams.get('chapter')

    let query = supabase
      .from('bible_bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (book) {
      query = query.eq('book', book)
    }

    if (chapterParam) {
      const chapter = Number(chapterParam)
      if (!Number.isInteger(chapter) || chapter <= 0) {
        return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
      }
      query = query.eq('chapter', chapter)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({ error: 'Failed to load bookmarks' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to load bookmarks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<BookmarkInsert>
    const { bookmark_type, book, chapter, start_verse, end_verse, title, color } = body

    if (!bookmark_type || !book || chapter === undefined) {
      return NextResponse.json(
        { error: 'bookmark_type, book, chapter are required' },
        { status: 400 }
      )
    }

    if (!['chapter', 'verse'].includes(bookmark_type)) {
      return NextResponse.json({ error: 'bookmark_type must be "chapter" or "verse"' }, { status: 400 })
    }

    if (!Number.isInteger(chapter) || chapter <= 0) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    const insertData: BookmarkInsert = {
      user_id: user.id,
      bookmark_type,
      book,
      chapter,
      start_verse: start_verse ?? null,
      end_verse: end_verse ?? null,
      title: title ?? '',
      color: color ?? '#3B82F6',
    }

    const { data, error: insertError } = await supabase
      .from('bible_bookmarks')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Bookmark already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('bible_bookmarks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 })
  }
}
