import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import type { CreateHighlightInput, HighlightColor } from '@/types'

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']

function isHighlightColor(value: string): value is HighlightColor {
  return HIGHLIGHT_COLORS.includes(value as HighlightColor)
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

    const body = (await request.json()) as Partial<CreateHighlightInput>
    const { book, chapter, verseStart, verseEnd, color, version } = body

    if (!book || !version || !color || chapter === undefined || verseStart === undefined || verseEnd === undefined) {
      return NextResponse.json(
        { error: 'book, chapter, verseStart, verseEnd, color, version are required' },
        { status: 400 }
      )
    }

    if (!isHighlightColor(color)) {
      return NextResponse.json({ error: 'Invalid highlight color' }, { status: 400 })
    }

    if (!Number.isInteger(chapter) || chapter <= 0) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    if (!Number.isInteger(verseStart) || !Number.isInteger(verseEnd) || verseStart <= 0 || verseEnd < verseStart) {
      return NextResponse.json({ error: 'Invalid verse range' }, { status: 400 })
    }

    const repositories = createServerRepositories(supabase)
    const existing = await repositories.highlight.getHighlights(book, chapter, version)
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
      book,
      chapter,
      verseStart,
      verseEnd,
      color,
      version,
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

    const body = (await request.json()) as { id?: string; color?: string }
    const { id, color } = body

    if (!id || !color) {
      return NextResponse.json({ error: 'id and color are required' }, { status: 400 })
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
