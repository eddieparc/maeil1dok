import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import type { HighlightColor } from '@/types'

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isUuidString(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === 'string' && HIGHLIGHT_COLORS.includes(value as HighlightColor)
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart <= bEnd && bStart <= aEnd
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
    const version = searchParams.get('version')

    // No filter params → return all user highlights (used by BibleHome dashboard for counts).
    if (!book && !chapterParam && !version) {
      const { data, error: queryError } = await supabase
        .from('user_highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (queryError) {
        return NextResponse.json({ error: 'Failed to load highlights' }, { status: 500 })
      }

      return NextResponse.json({ data: data ?? [] })
    }

    // Partial filter is invalid — require all three when filtering.
    if (!book || !chapterParam || !version) {
      return NextResponse.json({ error: 'book, chapter, version are required' }, { status: 400 })
    }

    const chapter = Number(chapterParam)
    if (!Number.isInteger(chapter) || chapter <= 0) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    const highlights = await repositories.highlight.getHighlights(book, chapter, version)

    return NextResponse.json(highlights)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load highlights' }, { status: 500 })
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

    const { book, chapter, verseStart, verseEnd, color, version } = body

    if (!isNonEmptyString(book) || !isNonEmptyString(version)) {
      return NextResponse.json(
        { error: 'book and version must be non-empty strings' },
        { status: 400 }
      )
    }

    if (!isHighlightColor(color)) {
      return NextResponse.json({ error: 'Invalid highlight color' }, { status: 400 })
    }

    if (!isPositiveInteger(chapter)) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    if (!isPositiveInteger(verseStart) || !isPositiveInteger(verseEnd) || verseEnd < verseStart) {
      return NextResponse.json({ error: 'Invalid verse range' }, { status: 400 })
    }

    const trimmedBook = book.trim()
    const trimmedVersion = version.trim()

    const repositories = createServerRepositories(supabase)
    const existing = await repositories.highlight.getHighlights(trimmedBook, chapter, trimmedVersion)
    const overlapping = existing.find((highlight) =>
      overlaps(highlight.verseStart, highlight.verseEnd, verseStart, verseEnd)
    )

    if (overlapping && (overlapping.verseStart !== verseStart || overlapping.verseEnd !== verseEnd)) {
      return NextResponse.json({ error: 'Overlapping highlights are not allowed' }, { status: 409 })
    }

    if (overlapping && overlapping.verseStart === verseStart && overlapping.verseEnd === verseEnd) {
      const updated = await repositories.highlight.updateHighlightColor(overlapping.id, color)
      return NextResponse.json(updated)
    }

    const created = await repositories.highlight.createHighlight({
      book: trimmedBook,
      chapter,
      verseStart,
      verseEnd,
      color,
      version: trimmedVersion,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save highlight' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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

    const { id, color } = body

    if (!isUuidString(id)) {
      return NextResponse.json({ error: 'id must be a UUID' }, { status: 400 })
    }

    if (!isHighlightColor(color)) {
      return NextResponse.json({ error: 'Invalid highlight color' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    const updated = await repositories.highlight.updateHighlightColor(id, color)

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update highlight' }, { status: 500 })
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

    const repositories = createServerRepositories(supabase)
    await repositories.highlight.deleteHighlight(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete highlight' }, { status: 500 })
  }
}
