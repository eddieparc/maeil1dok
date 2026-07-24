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

    let parsedPlanId: number | null = null
    if (planIdParam) {
      parsedPlanId = Number(planIdParam)
      if (!Number.isInteger(parsedPlanId) || parsedPlanId <= 0) {
        return NextResponse.json({ error: 'plan_id must be a positive integer' }, { status: 400 })
      }
    }

    // Restrict readable schedules to the caller's active subscriptions on active plans.
    let subscriptionQuery = supabase
      .from('plan_subscriptions')
      .select('id,plan_id,bible_reading_plans!inner(is_active)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('bible_reading_plans.is_active', true)

    if (parsedPlanId !== null) {
      subscriptionQuery = subscriptionQuery.eq('plan_id', parsedPlanId)
    }

    const { data: subscriptions, error: subError } = await subscriptionQuery

    if (subError) {
      return NextResponse.json({ error: 'Failed to load schedules' }, { status: 500 })
    }

    const readablePlanIds = Array.from(
      new Set((subscriptions ?? []).map((sub) => sub.plan_id))
    )

    if (parsedPlanId !== null && readablePlanIds.length === 0) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (readablePlanIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    let query = supabase
      .from('daily_schedules')
      .select('*')
      .in('plan_id', readablePlanIds)
      .order('date', { ascending: true })

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
