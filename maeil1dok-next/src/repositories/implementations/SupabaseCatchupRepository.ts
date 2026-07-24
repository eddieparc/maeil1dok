import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { ICatchupRepository } from '@/repositories/interfaces/ICatchupRepository'
import type { CatchupSession, CatchupSchedule, CatchupStatus, CatchupStrategy } from '@/types'
import { NotFoundError, NetworkError, AuthError } from '@/repositories/types/errors'

type DBSession = Database['public']['Tables']['catchup_sessions']['Row']
type DBSchedule = Database['public']['Tables']['catchup_schedules']['Row']

function mapSession(row: DBSession): CatchupSession {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    name: row.name,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    strategy: row.strategy as CatchupStrategy,
    targetRejoinDate: row.target_rejoin_date,
    maxDailyReadings: row.max_daily_readings,
    maxDailyChapters: row.max_daily_chapters,
    weekendMultiplier: Number(row.weekend_multiplier),
    status: row.status as CatchupStatus,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSchedule(row: DBSchedule): CatchupSchedule {
  return {
    id: row.id,
    sessionId: row.session_id,
    originalScheduleId: row.original_schedule_id,
    scheduledDate: row.scheduled_date,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabaseCatchupRepository implements ICatchupRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async getCurrentUserId(): Promise<string> {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    if (error || !user) throw new AuthError('Not authenticated')
    return user.id
  }

  // Object ownership: a catchup session belongs to a user through
  // subscription_id -> plan_subscriptions.user_id. Reading/mutating by id alone
  // relies solely on RLS (single point of failure); scoping every access to the
  // authenticated owner via this FK chain is defense-in-depth against IDOR.
  private async fetchOwnedSessionRow(id: string, userId: string): Promise<DBSession | null> {
    const { data, error } = await (this.supabase as unknown as {
      from: (t: string) => any
    })
      .from('catchup_sessions')
      .select('*, plan_subscriptions!inner(user_id)')
      .eq('id', id)
      .eq('plan_subscriptions.user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? (data as DBSession) : null
  }

  // A catchup schedule belongs to a user through
  // session_id -> catchup_sessions.subscription_id -> plan_subscriptions.user_id.
  private async fetchOwnedScheduleRow(id: string, userId: string): Promise<DBSchedule | null> {
    const { data, error } = await (this.supabase as unknown as {
      from: (t: string) => any
    })
      .from('catchup_schedules')
      .select('*, catchup_sessions!inner(subscription_id, plan_subscriptions!inner(user_id))')
      .eq('id', id)
      .eq('catchup_sessions.plan_subscriptions.user_id', userId)
      // Schedules under a terminal (completed/abandoned) session are immutable;
      // require the joined session to be active so completion toggles fail closed.
      .eq('catchup_sessions.status', 'active')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? (data as DBSchedule) : null
  }

  async createSession(
    data: Pick<CatchupSession, 'subscriptionId' | 'name' | 'rangeStart' | 'rangeEnd' | 'strategy'>
  ): Promise<CatchupSession> {
    const { data: created, error } = await (this.supabase
      .from('catchup_sessions') as any)
      .insert({
        subscription_id: data.subscriptionId,
        name: data.name,
        range_start: data.rangeStart,
        range_end: data.rangeEnd,
        strategy: data.strategy,
      })
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!created) throw new NetworkError('Failed to create catchup session')
    return mapSession(created)
  }

  async getSessionsForSubscription(subscriptionId: string): Promise<CatchupSession[]> {
    const { data, error } = await this.supabase
      .from('catchup_sessions')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })

    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapSession)
  }

  async getSessionById(id: string): Promise<CatchupSession | null> {
    const userId = await this.getCurrentUserId()
    const row = await this.fetchOwnedSessionRow(id, userId)
    return row ? mapSession(row) : null
  }

  async updateSessionStatus(id: string, status: CatchupStatus): Promise<CatchupSession> {
    const userId = await this.getCurrentUserId()
    const owned = await this.fetchOwnedSessionRow(id, userId)
    if (!owned) throw new NotFoundError('Catchup session not found')
    // Terminal sessions (completed/abandoned) are immutable; only active
    // sessions may transition. Treat a terminal row as not-found so callers
    // cannot re-mutate it or race two transitions.
    if (owned.status !== 'active') throw new NotFoundError('Catchup session not found')

    const updateData: Record<string, unknown> =
      status === 'completed'
        ? { status: 'completed', completed_at: new Date().toISOString() }
        : { status, completed_at: null }

    const { data: updated, error } = await (this.supabase
      .from('catchup_sessions') as any)
      .update(updateData)
      .eq('id', id)
      .eq('subscription_id', owned.subscription_id)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Catchup session not found')
    return mapSession(updated)
  }

  async getSchedulesForSession(sessionId: string): Promise<CatchupSchedule[]> {
    const { data, error } = await this.supabase
      .from('catchup_schedules')
      .select('*')
      .eq('session_id', sessionId)
      .order('scheduled_date')

    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapSchedule)
  }

  async markScheduleComplete(id: string): Promise<CatchupSchedule> {
    return this.setScheduleCompletion(id, true)
  }

  async markScheduleIncomplete(id: string): Promise<CatchupSchedule> {
    return this.setScheduleCompletion(id, false)
  }

  private async setScheduleCompletion(id: string, isCompleted: boolean): Promise<CatchupSchedule> {
    const userId = await this.getCurrentUserId()
    const owned = await this.fetchOwnedScheduleRow(id, userId)
    if (!owned) throw new NotFoundError('Catchup schedule not found')

    const { data: updated, error } = await (this.supabase
      .from('catchup_schedules') as any)
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('session_id', owned.session_id)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Catchup schedule not found')
    return mapSchedule(updated)
  }
}
