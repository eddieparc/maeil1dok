import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncHasenaEntries } from '@/lib/hasena/hasenaSync'
import type { Database, Json } from '@/lib/supabase/database.types'

type HasenaEntryRow = Database['public']['Tables']['hasena_entries']['Row']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = request.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const entry = await getEntryForDate(supabase, date)
  if (!entry) {
    return NextResponse.json({ error: 'Hasena entry not available' }, { status: 404 })
  }

  const { data: record } = await supabase
    .from('hasena_records')
    .select('is_completed')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  return NextResponse.json({
    entry: mapEntry(entry),
    isCompleted: record?.is_completed ?? false,
  })
}

async function getEntryForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
): Promise<HasenaEntryRow | null> {
  const cached = await selectEntry(supabase, date)
  if (cached) return cached

  try {
    await syncHasenaEntries({ maxEntries: 14 })
  } catch {
    return null
  }

  return selectEntry(supabase, date)
}

async function selectEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
): Promise<HasenaEntryRow | null> {
  const { data, error } = await supabase
    .from('hasena_entries')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) return null
  return data
}

function mapEntry(row: HasenaEntryRow) {
  return {
    id: row.id,
    date: row.date,
    videoId: row.video_id,
    title: row.title,
    passage: row.passage,
    bodyText: row.body_text,
    verses: parseVerses(row.verses),
    sourceUrl: row.source_url,
    bodySourceUrl: row.body_source_url,
    fetchedAt: row.fetched_at,
  }
}

function parseVerses(value: Json) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const number = item.number
    const text = item.text
    if (typeof number !== 'string' || typeof text !== 'string') return []
    return [{ number, text }]
  })
}
