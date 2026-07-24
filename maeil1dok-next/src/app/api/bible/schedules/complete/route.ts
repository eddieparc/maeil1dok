import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'

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

    const parseResult = await parseJsonBody<{
      schedule_id?: string
      subscription_id?: string
    }>(request)

    if (!parseResult.ok) {
      return parseResult.response
    }

    const { schedule_id, subscription_id } = parseResult.body

    if (!schedule_id || !subscription_id) {
      return NextResponse.json(
        { error: 'schedule_id, subscription_id are required' },
        { status: 400 }
      )
    }

    // Verify active subscription and active plan belong to user
    const { data: subscription, error: subError } = await supabase
      .from('plan_subscriptions')
      .select('id,plan_id,bible_reading_plans!inner(is_active)')
      .eq('id', subscription_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('bible_reading_plans.is_active', true)
      .single()

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from('daily_schedules')
      .select('id')
      .eq('id', schedule_id)
      .eq('plan_id', subscription.plan_id)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Upsert progress: mark as completed
    const now = new Date().toISOString()

    const { data, error: upsertError } = await supabase
      .from('user_progress')
      .upsert(
        {
          subscription_id,
          schedule_id,
          is_completed: true,
          completed_at: now,
          updated_at: now,
        },
        { onConflict: 'subscription_id,schedule_id' }
      )
      .select()
      .single()

    if (upsertError) {
      // If upsert fails (no unique constraint), try insert/update manually
      const { data: existing } = await supabase
        .from('user_progress')
        .select('id')
        .eq('subscription_id', subscription_id)
        .eq('schedule_id', schedule_id)
        .single()

      if (existing) {
        const { data: updated, error: updateError } = await supabase
          .from('user_progress')
          .update({
            is_completed: true,
            completed_at: now,
            updated_at: now,
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) {
          return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 })
        }

        return NextResponse.json({ data: updated })
      } else {
        const { data: created, error: insertError } = await supabase
          .from('user_progress')
          .insert({
            subscription_id,
            schedule_id,
            is_completed: true,
            completed_at: now,
          })
          .select()
          .single()

        if (insertError) {
          return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 })
        }

        return NextResponse.json({ data: created }, { status: 201 })
      }
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 })
  }
}
