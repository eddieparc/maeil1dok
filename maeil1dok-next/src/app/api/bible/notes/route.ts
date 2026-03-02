import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type NoteInsert = Database['public']['Tables']['reflection_notes']['Insert']

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
      .from('reflection_notes')
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
      return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
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

    const body = (await request.json()) as Partial<NoteInsert>
    const { book, chapter, start_verse, end_verse, content, is_private } = body

    if (!book || chapter === undefined || !content) {
      return NextResponse.json(
        { error: 'book, chapter, content are required' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(chapter) || chapter <= 0) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    const insertData: NoteInsert = {
      user_id: user.id,
      book,
      chapter,
      start_verse: start_verse ?? null,
      end_verse: end_verse ?? null,
      content,
      is_private: is_private ?? true,
    }

    const { data, error: insertError } = await supabase
      .from('reflection_notes')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
