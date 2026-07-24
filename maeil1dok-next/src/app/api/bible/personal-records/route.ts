import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import { BIBLE_BOOKS } from '@/lib/bible/books'

type RecordInsert = Database['public']['Tables']['personal_reading_records']['Insert']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function normalizeBookCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(BIBLE_BOOKS, normalized)) return null
  return normalized
}

function parseIsoDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${match[1]}-${match[2]}-${match[3]}`
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
    const hasBook = searchParams.has('book')
    const hasDateFrom = searchParams.has('date_from')
    const hasDateTo = searchParams.has('date_to')
    const normalizedBook = hasBook ? normalizeBookCode(searchParams.get('book')) : null
    const normalizedDateFrom = hasDateFrom ? parseIsoDateKey(searchParams.get('date_from')) : null
    const normalizedDateTo = hasDateTo ? parseIsoDateKey(searchParams.get('date_to')) : null

    if (hasBook && normalizedBook === null) {
      return NextResponse.json(
        { error: 'book must be a supported Bible book code' },
        { status: 400 }
      )
    }

    if (hasDateFrom && normalizedDateFrom === null) {
      return NextResponse.json(
        { error: 'date_from must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }

    if (hasDateTo && normalizedDateTo === null) {
      return NextResponse.json(
        { error: 'date_to must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }

    if (
      normalizedDateFrom !== null &&
      normalizedDateTo !== null &&
      normalizedDateFrom > normalizedDateTo
    ) {
      return NextResponse.json(
        { error: 'date_from must be before or equal to date_to' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('personal_reading_records')
      .select('*')
      .eq('user_id', user.id)
      .order('read_date', { ascending: false })

    if (normalizedBook !== null) {
      query = query.eq('book', normalizedBook)
    }

    if (normalizedDateFrom !== null) {
      query = query.gte('read_date', normalizedDateFrom)
    }

    if (normalizedDateTo !== null) {
      query = query.lte('read_date', normalizedDateTo)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({ error: 'Failed to load personal records' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to load personal records' }, { status: 500 })
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

    const { book, chapter, read_date } = body

    const normalizedBook = normalizeBookCode(book)
    if (normalizedBook === null) {
      return NextResponse.json(
        { error: 'book must be a supported Bible book code' },
        { status: 400 }
      )
    }

    if (!isPositiveInteger(chapter)) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    if (chapter > BIBLE_BOOKS[normalizedBook].chapters) {
      return NextResponse.json({ error: 'chapter is out of range for book' }, { status: 400 })
    }

    const normalizedDate = parseIsoDateKey(read_date)
    if (normalizedDate === null) {
      return NextResponse.json(
        { error: 'read_date must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }

    const insertData: RecordInsert = {
      user_id: user.id,
      book: normalizedBook,
      chapter,
      read_date: normalizedDate,
    }

    const { data, error: insertError } = await supabase
      .from('personal_reading_records')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Record already exists for this book and chapter' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create personal record' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create personal record' }, { status: 500 })
  }
}
