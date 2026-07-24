import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IScheduleRepository } from '@/repositories/interfaces/IScheduleRepository'
import type { DailySchedule } from '@/types'
import { NotFoundError, NetworkError } from '@/repositories/types/errors'

type DBSchedule = Database['public']['Tables']['daily_schedules']['Row']

function mapSchedule(row: DBSchedule): DailySchedule {
  return {
    id: row.id,
    planId: row.plan_id,
    date: row.date,
    book: row.book,
    startChapter: row.start_chapter,
    endChapter: row.end_chapter,
    audioLink: row.audio_link,
    guideLink: row.guide_link,
    createdAt: row.created_at,
  }
}

export class SupabaseScheduleRepository implements IScheduleRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getScheduleByDate(date: string): Promise<DailySchedule | null> {
    const { data, error } = await this.supabase
      .from('daily_schedules')
      .select('*')
      .eq('date', date)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapSchedule(data) : null
  }

  async getSchedulesForPlan(planId: number, start: string, end: string): Promise<DailySchedule[]> {
    const { data, error } = await this.supabase
      .from('daily_schedules')
      .select('*')
      .eq('plan_id', planId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
    
    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapSchedule)
  }

  async getSchedulesForPlans(planIds: number[], start: string, end: string): Promise<DailySchedule[]> {
    const uniquePlanIds = [...new Set(planIds)]
    if (uniquePlanIds.length === 0) return []

    const { data, error } = await this.supabase
      .from('daily_schedules')
      .select('*')
      .in('plan_id', uniquePlanIds)
      .gte('date', start)
      .lte('date', end)
      .order('date')

    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapSchedule)
  }

  async getCurrentSchedule(): Promise<DailySchedule | null> {
    const today = new Date().toISOString().split('T')[0]
    return this.getScheduleByDate(today)
  }

  async getScheduleById(id: string): Promise<DailySchedule | null> {
    const { data, error } = await this.supabase
      .from('daily_schedules')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapSchedule(data) : null
  }
}
