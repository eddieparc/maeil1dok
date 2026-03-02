import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const planIdParam = searchParams.get('plan_id')
    const date = searchParams.get('date')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabase
      .from('daily_schedules')
      .select('*')
      .order('date', { ascending: true })

    if (planIdParam) {
      const planId = Number(planIdParam)
      if (!Number.isInteger(planId) || planId <= 0) {
        return NextResponse.json({ error: 'plan_id must be a positive integer' }, { status: 400 })
      }
      query = query.eq('plan_id', planId)
    }

    if (date) {
      query = query.eq('date', date)
    }

    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('date', dateTo)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 })
  }
}
