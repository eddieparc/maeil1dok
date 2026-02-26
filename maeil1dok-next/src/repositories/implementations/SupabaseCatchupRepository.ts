import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { ICatchupRepository } from '@/repositories/interfaces/ICatchupRepository'
import type { CatchupSession, CatchupSchedule, CatchupStatus, CatchupStrategy } from '@/types'
import { NotFoundError, NetworkError } from '@/repositories/types/errors'

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
    const { data, error } = await this.supabase
      .from('catchup_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapSession(data) : null
  }

  async updateSessionStatus(id: string, status: CatchupStatus): Promise<CatchupSession> {
    const updateData: Record<string, unknown> = { status }
    if (status === 'completed') updateData.completed_at = new Date().toISOString()

    const { data: updated, error } = await (this.supabase
      .from('catchup_sessions') as any)
      .update(updateData)
      .eq('id', id)
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
    const { data: updated, error } = await (this.supabase
      .from('catchup_schedules') as any)
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Catchup schedule not found')
    return mapSchedule(updated)
  }

  async markScheduleIncomplete(id: string): Promise<CatchupSchedule> {
    const { data: updated, error } = await (this.supabase
      .from('catchup_schedules') as any)
      .update({
        is_completed: false,
        completed_at: null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Catchup schedule not found')
    return mapSchedule(updated)
  }
}
