import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import type { CatchupSession, DailySchedule } from '@/types'
import { CatchupClient } from '@/components/catchup/CatchupClient'
import type { TodayCatchupItem } from '@/components/catchup/TodayCatchupList'

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getMissedSchedules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscriptionId: string,
  planId: number,
  today: string
): Promise<DailySchedule[]> {
  const { data: schedules } = await supabase
    .from('daily_schedules')
    .select('id,plan_id,date,book,start_chapter,end_chapter,audio_link,guide_link,created_at')
    .eq('plan_id', planId)
    .lt('date', today)
    .order('date', { ascending: true })

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
  const { data: progressRows } = await supabase
    .from('user_progress')
    .select('schedule_id,is_completed')
    .eq('subscription_id', subscriptionId)
    .in('schedule_id', scheduleIds)

  const completedIds = new Set((progressRows ?? []).filter((row) => row.is_completed).map((row) => row.schedule_id))

  return allSchedules.filter((schedule) => !completedIds.has(schedule.id))
}

function getEstimatedCompletionDate(schedules: { scheduledDate: string; isCompleted: boolean }[]): string | null {
  const pending = schedules.filter((value) => !value.isCompleted)
  const base = pending.length > 0 ? pending : schedules
  if (base.length === 0) return null

  return [...base].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[base.length - 1].scheduledDate
}

export default async function CatchupPage() {
  const supabase = await createClient()
  const repositories = createServerRepositories(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const subscriptions = await repositories.plan.getUserSubscriptions()
  const activeSubscription = subscriptions.find((subscription) => subscription.isActive) ?? null

  if (!activeSubscription) {
    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }} className="pb-24">
        <CatchupClient
          planId={null}
          missedCount={0}
          missedSchedules={[]}
          activeSession={null}
          todayReadings={[]}
          progress={{ completedCount: 0, totalCount: 0, estimatedCompletionDate: null }}
        />
      </main>
    )
  }

  const today = getTodayString()
  const missedSchedules = await getMissedSchedules(supabase, activeSubscription.id, activeSubscription.planId, today)

  let activeSession: CatchupSession | null = null
  let todayReadings: TodayCatchupItem[] = []
  let progress = { completedCount: 0, totalCount: 0, estimatedCompletionDate: null as string | null }

  const sessions = await repositories.catchup.getSessionsForSubscription(activeSubscription.id)
  activeSession = sessions.find((session) => session.status === 'active') ?? null

  if (activeSession) {
    const schedules = await repositories.catchup.getSchedulesForSession(activeSession.id)
    const todaySchedules = schedules.filter((schedule) => schedule.scheduledDate === today)
    const originalIds = todaySchedules
      .map((schedule) => schedule.originalScheduleId)
      .filter((scheduleId): scheduleId is string => typeof scheduleId === 'string')

    let mappedDailySchedules = new Map<string, DailySchedule>()
    if (originalIds.length > 0) {
      const { data: rows } = await supabase
        .from('daily_schedules')
        .select('id,plan_id,date,book,start_chapter,end_chapter,audio_link,guide_link,created_at')
        .in('id', originalIds)

      mappedDailySchedules = new Map(
        (rows ?? []).map((row) => [
          row.id,
          {
            id: row.id,
            planId: row.plan_id,
            date: row.date,
            book: row.book,
            startChapter: row.start_chapter,
            endChapter: row.end_chapter,
            audioLink: row.audio_link,
            guideLink: row.guide_link,
            createdAt: row.created_at,
          },
        ])
      )
    }

    todayReadings = todaySchedules.map((schedule) => {
      const original = schedule.originalScheduleId ? mappedDailySchedules.get(schedule.originalScheduleId) : null
      return {
        id: schedule.id,
        date: schedule.scheduledDate,
        isCompleted: schedule.isCompleted,
        book: original?.book ?? '읽기 일정',
        startChapter: original?.startChapter ?? 1,
        endChapter: original?.endChapter ?? 1,
      }
    })

    const completedCount = schedules.filter((schedule) => schedule.isCompleted).length
    progress = {
      completedCount,
      totalCount: schedules.length,
      estimatedCompletionDate: getEstimatedCompletionDate(schedules),
    }
  }

  return (
    <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }} className="pb-24">
      <CatchupClient
        planId={activeSubscription.planId}
        missedCount={missedSchedules.length}
        missedSchedules={missedSchedules}
        activeSession={activeSession}
        todayReadings={todayReadings}
        progress={progress}
      />
    </main>
  )
}
