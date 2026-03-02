import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type SupabaseDB = SupabaseClient<Database>

type PlanSubscriptionRow = Database['public']['Tables']['plan_subscriptions']['Row']
type ScheduleRow = Database['public']['Tables']['daily_schedules']['Row']
type ProgressInsert = Database['public']['Tables']['user_progress']['Insert']

type ScheduleWithProgress = ScheduleRow & { is_completed: boolean }

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

async function getActiveSubscription(
  supabase: SupabaseDB,
  userId: string,
  planId: number
): Promise<{ data: PlanSubscriptionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('plan_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('is_active', true)
    .single()

  if (error?.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return { data: (data as PlanSubscriptionRow | null) ?? null, error }
}

export async function getSchedules(
  supabase: SupabaseDB,
  userId: string,
  planId: number
): RepositoryResult<ScheduleWithProgress[]> {
  const subscriptionResult = await getActiveSubscription(supabase, userId, planId)
  if (subscriptionResult.error) {
    return { data: null, error: subscriptionResult.error }
  }

  const subscription = subscriptionResult.data
  if (!subscription) {
    return { data: [], error: null }
  }

  const schedulesResult = await supabase
    .from('daily_schedules')
    .select('*')
    .eq('plan_id', planId)
    .order('date', { ascending: true })

  if (schedulesResult.error) {
    return { data: null, error: schedulesResult.error }
  }

  const schedules = (schedulesResult.data as ScheduleRow[] | null) ?? []
  if (schedules.length === 0) {
    return { data: [], error: null }
  }

  const scheduleIds = schedules.map((schedule) => schedule.id)
  const progressResult = await supabase
    .from('user_progress')
    .select('schedule_id,is_completed')
    .eq('subscription_id', subscription.id)
    .in('schedule_id', scheduleIds)

  if (progressResult.error) {
    return { data: null, error: progressResult.error }
  }

  const completionMap = new Map(
    ((progressResult.data as Array<{ schedule_id: string; is_completed: boolean }> | null) ?? []).map(
      (progress) => [progress.schedule_id, progress.is_completed]
    )
  )

  const merged = schedules.map((schedule) => ({
    ...schedule,
    is_completed: completionMap.get(schedule.id) ?? false,
  }))

  return { data: merged, error: null }
}

export async function getMonthlySchedules(
  supabase: SupabaseDB,
  planId: number,
  year: number,
  month: number
): RepositoryResult<ScheduleRow[]> {
  const range = getMonthRange(year, month)
  const { data, error } = await supabase
    .from('daily_schedules')
    .select('*')
    .eq('plan_id', planId)
    .gte('date', range.start)
    .lte('date', range.end)
    .order('date', { ascending: true })

  return { data: data ?? [], error }
}

export async function getTodaySchedules(
  supabase: SupabaseDB,
  planId: number,
  today?: string
): RepositoryResult<ScheduleRow[]> {
  const targetDate = today ?? new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('daily_schedules')
    .select('*')
    .eq('plan_id', planId)
    .eq('date', targetDate)
    .order('start_chapter', { ascending: true })

  return { data: data ?? [], error }
}

export async function getNextPosition(
  supabase: SupabaseDB,
  userId: string,
  planId: number,
  today?: string
): RepositoryResult<{ book: string; chapter: number; schedule_id: string }> {
  const schedulesResult = await getSchedules(supabase, userId, planId)
  if (schedulesResult.error) {
    return { data: null, error: schedulesResult.error }
  }

  const targetDate = today ?? new Date().toISOString().split('T')[0]
  const candidate = (schedulesResult.data ?? []).find(
    (schedule) => !schedule.is_completed && schedule.date >= targetDate
  )

  if (!candidate) {
    return { data: null, error: null }
  }

  return {
    data: {
      book: candidate.book,
      chapter: candidate.start_chapter,
      schedule_id: candidate.id,
    },
    error: null,
  }
}

export async function completeSchedule(
  supabase: SupabaseDB,
  subscriptionId: string,
  scheduleId: string
): RepositoryResult<{ success: boolean }> {
  const payload: ProgressInsert = {
    subscription_id: subscriptionId,
    schedule_id: scheduleId,
    is_completed: true,
    completed_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('user_progress')
    .upsert(payload as never, { onConflict: 'subscription_id,schedule_id' })

  return {
    data: error ? null : { success: true },
    error,
  }
}
