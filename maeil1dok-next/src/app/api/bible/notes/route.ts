import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import type { Database } from '@/lib/supabase/database.types'

type NoteInsert = Database['public']['Tables']['reflection_notes']['Insert']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean'
}

type VerseWindow = { start_verse: number | null; end_verse: number | null }

function resolveNullableVerseWindow(
  start: unknown,
  end: unknown
): { ok: true; value: VerseWindow } | { ok: false } {
  const startEmpty = start === undefined || start === null
  const endEmpty = end === undefined || end === null

  if (startEmpty && endEmpty) {
    return { ok: true, value: { start_verse: null, end_verse: null } }
  }

  if (startEmpty !== endEmpty) {
    return { ok: false }
  }

  if (!isPositiveInteger(start) || !isPositiveInteger(end) || end < start) {
    return { ok: false }
  }

  return { ok: true, value: { start_verse: start, end_verse: end } }
}

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

    const parseResult = await parseJsonBody<unknown>(request)
    if (!parseResult.ok) {
      return parseResult.response
    }

    const body = parseResult.body
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const { book, chapter, start_verse, end_verse, content, is_private } = body

    if (!isNonEmptyString(book)) {
      return NextResponse.json({ error: 'book must be a non-empty string' }, { status: 400 })
    }

    if (!isPositiveInteger(chapter)) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    if (!isNonEmptyString(content)) {
      return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 })
    }

    if (!isOptionalBoolean(is_private)) {
      return NextResponse.json({ error: 'is_private must be a boolean' }, { status: 400 })
    }

    const verseWindow = resolveNullableVerseWindow(start_verse, end_verse)
    if (!verseWindow.ok) {
      return NextResponse.json(
        { error: 'start_verse and end_verse must both be null or positive ordered integers' },
        { status: 400 }
      )
    }

    const insertData: NoteInsert = {
      user_id: user.id,
      book: book.trim(),
      chapter,
      start_verse: verseWindow.value.start_verse,
      end_verse: verseWindow.value.end_verse,
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
