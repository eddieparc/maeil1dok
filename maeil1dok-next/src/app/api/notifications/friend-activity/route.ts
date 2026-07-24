import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyFollowersOfCompletion } from '@/lib/notifications/friendActivity'
import { parseJsonBody } from '@/lib/api/parseJsonBody'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
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

    const { activityType, subscriptionId, scheduleId } = body

    // Hasena completion notifications must originate from /api/hasena/complete,
    // which validates and writes the Hasena record before notifying. Reject any
    // other activity type here so it cannot be spoofed.
    if (activityType !== 'reading') {
      return NextResponse.json({ error: 'activityType must be "reading"' }, { status: 400 })
    }

    if (!isNonEmptyString(subscriptionId) || !isNonEmptyString(scheduleId)) {
      return NextResponse.json(
        { error: 'subscriptionId and scheduleId are required' },
        { status: 400 }
      )
    }

    // Verify the subscription is owned by the caller, active, and joins an active plan.
    // Same authorization shape as /api/bible/schedules/complete.
    const { data: subscription, error: subError } = await supabase
      .from('plan_subscriptions')
      .select('id,plan_id,bible_reading_plans!inner(is_active)')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('bible_reading_plans.is_active', true)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Verify the schedule belongs to the subscription's plan.
    const { data: schedule, error: scheduleError } = await supabase
      .from('daily_schedules')
      .select('id')
      .eq('id', scheduleId)
      .eq('plan_id', subscription.plan_id)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Verify the caller actually completed this schedule before notifying followers.
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('id')
      .eq('subscription_id', subscriptionId)
      .eq('schedule_id', scheduleId)
      .eq('is_completed', true)
      .single()

    if (progressError || !progress) {
      return NextResponse.json({ error: 'Completed progress not found' }, { status: 403 })
    }

    // Fire-and-forget — respond immediately, send notifications in background.
    void notifyFollowersOfCompletion(user.id, 'reading')

    return NextResponse.json({ status: 'queued' })
  } catch {
    return NextResponse.json({ error: 'Failed to queue notification' }, { status: 500 })
  }
}
