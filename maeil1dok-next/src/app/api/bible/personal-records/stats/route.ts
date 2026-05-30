import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BIBLE_BOOKS } from '@/lib/bible/books'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: records, error: queryError } = await supabase
      .from('personal_reading_records')
      .select('book, chapter, read_date')
      .eq('user_id', user.id)

    if (queryError) {
      return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
    }

    const rows = records ?? []

    const grouped = rows.reduce<Record<string, Set<number>>>((acc, row) => {
      if (!row.book || row.chapter == null) return acc
      if (!acc[row.book]) acc[row.book] = new Set<number>()
      acc[row.book].add(row.chapter)
      return acc
    }, {})

    const books_progress: Record<string, { read: number }> = {}
    let total_chapters_read = 0
    let books_completed = 0
    let books_read = 0

    for (const [bookId, chapters] of Object.entries(grouped)) {
      const read = chapters.size
      const total = BIBLE_BOOKS[bookId]?.chapters ?? 0
      books_progress[bookId] = { read }
      total_chapters_read += read
      if (read > 0) books_read += 1
      if (total > 0 && read >= total) books_completed += 1
    }

    const uniqueDates = Array.from(
      new Set(rows.map((row) => row.read_date).filter((d): d is string => typeof d === 'string')),
    ).sort()

    const readingSet = new Set(uniqueDates)
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    let current_streak = 0
    while (current_streak < 365 * 5) {
      const iso = cursor.toISOString().split('T')[0]
      if (!readingSet.has(iso)) break
      current_streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_chapters_read,
        books_read,
        books_completed,
        current_streak,
        books_progress,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
