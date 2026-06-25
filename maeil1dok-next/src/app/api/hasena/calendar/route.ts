import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mergeHasenaCalendarEntries } from '@/lib/hasena/hasenaSources'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yearValue = request.nextUrl.searchParams.get('year')
  const monthValue = request.nextUrl.searchParams.get('month')
  const year = Number(yearValue)
  const month = Number(monthValue)

  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2020 || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month are required' }, { status: 400 })
  }

  const rangeStart = `${year}-${String(month).padStart(2, '0')}-01`
  const rangeEnd = formatDate(new Date(year, month, 1))

  const [{ data: entryRows, error: entryError }, { data: recordRows, error: recordError }] = await Promise.all([
    supabase
      .from('hasena_entries')
      .select('date, passage, video_id, title')
      .gte('date', rangeStart)
      .lt('date', rangeEnd)
      .order('date', { ascending: true }),
    supabase
      .from('hasena_records')
      .select('date, is_completed')
      .eq('user_id', user.id)
      .gte('date', rangeStart)
      .lt('date', rangeEnd),
  ])

  if (entryError || recordError) {
    return NextResponse.json({ error: 'Failed to load Hasena calendar' }, { status: 500 })
  }

  const entries = mergeHasenaCalendarEntries(
    (entryRows ?? []).map((row) => ({
      date: row.date,
      passage: row.passage,
      videoId: row.video_id,
      title: row.title,
    })),
    (recordRows ?? []).map((row) => ({
      date: row.date,
      isCompleted: row.is_completed,
    })),
  )

  return NextResponse.json({ entries })
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
