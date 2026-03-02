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

    const today = new Date().toISOString().split('T')[0]

    // Get user's active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('plan_subscriptions')
      .select('id, plan_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (subError) {
      return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const planIds = subscriptions.map((s) => s.plan_id)

    // Get today's schedules for subscribed plans
    const { data: schedules, error: scheduleError } = await supabase
      .from('daily_schedules')
      .select('*')
      .in('plan_id', planIds)
      .eq('date', today)
      .order('plan_id', { ascending: true })

    if (scheduleError) {
      return NextResponse.json({ error: 'Failed to load today schedules' }, { status: 500 })
    }

    // Get progress for today's schedules
    const scheduleIds = (schedules || []).map((s) => s.id)
    const subscriptionIds = subscriptions.map((s) => s.id)

    let progress: { schedule_id: string; is_completed: boolean }[] = []
    if (scheduleIds.length > 0) {
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('schedule_id, is_completed')
        .in('subscription_id', subscriptionIds)
        .in('schedule_id', scheduleIds)

      progress = progressData || []
    }

    // Merge schedules with progress
    const schedulesWithProgress = (schedules || []).map((schedule) => {
      const progressItem = progress.find((p) => p.schedule_id === schedule.id)
      return {
        ...schedule,
        is_completed: progressItem?.is_completed ?? false,
      }
    })

    return NextResponse.json({ data: schedulesWithProgress })
  } catch {
    return NextResponse.json({ error: 'Failed to load today schedules' }, { status: 500 })
  }
}
