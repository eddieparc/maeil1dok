import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { data, error: queryError } = await supabase
      .from('personal_reading_records')
      .select('read_date')
      .eq('user_id', user.id)

    if (queryError) {
      return NextResponse.json({ error: 'Failed to load dates' }, { status: 500 })
    }

    const dates = Array.from(
      new Set((data ?? []).map((row) => row.read_date).filter((d): d is string => typeof d === 'string')),
    ).sort()

    return NextResponse.json({ success: true, dates })
  } catch {
    return NextResponse.json({ error: 'Failed to load dates' }, { status: 500 })
  }
}
