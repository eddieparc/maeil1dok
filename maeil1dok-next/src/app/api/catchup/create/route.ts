import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { generateCatchupSchedule } from '@/lib/catchup/scheduling'
import type { DailySchedule } from '@/types'

interface CreateCatchupRequestBody {
  planId?: number
  strategy?: 'parallel' | 'sequential'
  targetDate?: string
  maxDailyReadings?: number
  maxDailyChapters?: number
  weekendMultiplier?: number
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getMissedSchedules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscriptionId: string,
  planId: number,
  today: string
): Promise<DailySchedule[]> {
  const { data: schedules, error: scheduleError } = await supabase
    .from('daily_schedules')
    .select('id,plan_id,date,book,start_chapter,end_chapter,audio_link,guide_link,created_at')
    .eq('plan_id', planId)
    .lt('date', today)
    .order('date', { ascending: true })

  if (scheduleError) {
    throw new Error('Failed to fetch schedules')
  }

  const allSchedules =
    schedules?.map((row) => ({
      id: row.id,
      planId: row.plan_id,
      date: row.date,
      book: row.book,
      startChapter: row.start_chapter,
      endChapter: row.end_chapter,
      audioLink: row.audio_link,
      guideLink: row.guide_link,
      createdAt: row.created_at,
    })) ?? []

  if (allSchedules.length === 0) return []

  const scheduleIds = allSchedules.map((schedule) => schedule.id)
  const { data: progressRows, error: progressError } = await supabase
    .from('user_progress')
    .select('schedule_id,is_completed')
    .eq('subscription_id', subscriptionId)
    .in('schedule_id', scheduleIds)

  if (progressError) {
    throw new Error('Failed to fetch progress')
  }

  const completedIds = new Set((progressRows ?? []).filter((row) => row.is_completed).map((row) => row.schedule_id))
  return allSchedules.filter((schedule) => !completedIds.has(schedule.id))
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateCatchupRequestBody
    const {
      planId,
      strategy = 'parallel',
      targetDate,
      maxDailyReadings = 3,
      maxDailyChapters = 5,
      weekendMultiplier = 1.5,
    } = body

    if (!planId || !targetDate) {
      return NextResponse.json({ error: 'planId and targetDate are required' }, { status: 400 })
    }

    if (!['parallel', 'sequential'].includes(strategy)) {
      return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 })
    }

    if (maxDailyReadings <= 0 || maxDailyChapters <= 0 || weekendMultiplier <= 0) {
      return NextResponse.json({ error: 'Invalid numeric settings' }, { status: 400 })
    }

    const target = new Date(`${targetDate}T00:00:00`)
    if (Number.isNaN(target.getTime())) {
      return NextResponse.json({ error: 'Invalid targetDate' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const repositories = createServerRepositories(supabase)
    const subscriptions = await repositories.plan.getUserSubscriptions()
    const selectedSubscription = subscriptions.find((subscription) => subscription.planId === planId)

    if (!selectedSubscription) {
      return NextResponse.json({ error: 'Subscription not found for plan' }, { status: 403 })
    }

    const existingSessions = await repositories.catchup.getSessionsForSubscription(selectedSubscription.id)
    const existingActive = existingSessions.find((session) => session.status === 'active')
    if (existingActive) {
      return NextResponse.json({ error: 'Active catchup session already exists' }, { status: 409 })
    }

    const today = todayString()
    const missedSchedules = await getMissedSchedules(supabase, selectedSubscription.id, planId, today)
    if (missedSchedules.length === 0) {
      return NextResponse.json({ error: 'No missed schedules to catch up' }, { status: 400 })
    }

    const generated = generateCatchupSchedule({
      missedSchedules,
      strategy,
      targetRejoinDate: target,
      maxDailyReadings,
      maxDailyChapters,
      weekendMultiplier,
      startDate: new Date(`${today}T00:00:00`),
    })

    const scheduleRows = generated.days.flatMap((day) =>
      day.schedules.map((schedule) => ({
        original_schedule_id: schedule.id,
        scheduled_date: day.date.toISOString().slice(0, 10),
      }))
    )

    if (scheduleRows.length === 0) {
      return NextResponse.json({ error: 'Unable to build a valid catchup schedule' }, { status: 400 })
    }

    const { data: createdSession, error: createSessionError } = await (supabase.from('catchup_sessions') as any)
      .insert({
        subscription_id: selectedSubscription.id,
        name: `${today} 캐치업`,
        range_start: missedSchedules[0].date,
        range_end: missedSchedules[missedSchedules.length - 1].date,
        strategy,
        target_rejoin_date: targetDate,
        max_daily_readings: maxDailyReadings,
        max_daily_chapters: maxDailyChapters,
        weekend_multiplier: weekendMultiplier,
        status: 'active',
      })
      .select('*')
      .single()

    if (createSessionError || !createdSession) {
      return NextResponse.json({ error: 'Failed to create catchup session' }, { status: 500 })
    }

    const { error: createSchedulesError } = await (supabase.from('catchup_schedules') as any).insert(
      scheduleRows.map((row) => ({
        session_id: createdSession.id,
        original_schedule_id: row.original_schedule_id,
        scheduled_date: row.scheduled_date,
      }))
    )

    if (createSchedulesError) {
      await (supabase.from('catchup_sessions') as any)
        .update({ status: 'abandoned' })
        .eq('id', createdSession.id)
      return NextResponse.json({ error: 'Failed to create catchup schedule rows' }, { status: 500 })
    }

    return NextResponse.json({
      session: createdSession,
      summary: {
        totalDays: generated.totalDays,
        canComplete: generated.canComplete,
        remainingAfterTarget: generated.remainingAfterTarget.length,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to create catchup session' }, { status: 500 })
  }
}
