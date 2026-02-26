import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IProgressRepository } from '@/repositories/interfaces/IProgressRepository'
import type { UserProgress, ProgressSummary } from '@/types'
import { NetworkError } from '@/repositories/types/errors'

type DBProgress = Database['public']['Tables']['user_progress']['Row']

function mapProgress(row: DBProgress): UserProgress {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    scheduleId: row.schedule_id,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabaseProgressRepository implements IProgressRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getProgress(subscriptionId: string, scheduleId: string): Promise<UserProgress | null> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .eq('schedule_id', scheduleId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }

    return data ? mapProgress(data) : null
  }

  async markComplete(subscriptionId: string, scheduleId: string): Promise<UserProgress> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .upsert(
        {
          subscription_id: subscriptionId,
          schedule_id: scheduleId,
          is_completed: true,
          completed_at: new Date().toISOString(),
        } as any,
        {
          onConflict: 'subscription_id,schedule_id',
        }
      )
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to mark as complete')

    return mapProgress(data)
  }

  async markIncomplete(subscriptionId: string, scheduleId: string): Promise<UserProgress> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .upsert(
        {
          subscription_id: subscriptionId,
          schedule_id: scheduleId,
          is_completed: false,
          completed_at: null,
        } as any,
        {
          onConflict: 'subscription_id,schedule_id',
        }
      )
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to mark as incomplete')

    return mapProgress(data)
  }

  async getProgressForSubscription(subscriptionId: string): Promise<UserProgress[]> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })

    if (error) throw new NetworkError(error.message, error)

    return (data ?? []).map(mapProgress)
  }

  async getProgressSummary(subscriptionId: string): Promise<ProgressSummary> {
    const { data, error } = await this.supabase
      .from('user_progress')
      .select('is_completed')
      .eq('subscription_id', subscriptionId)

    if (error) throw new NetworkError(error.message, error)

    const allProgress = (data ?? []) as Array<{ is_completed: boolean }>
    const totalDays = allProgress.length
    const completedDays = allProgress.filter((p) => p.is_completed).length

    const {
      data: { user },
    } = await this.supabase.auth.getUser()

    if (user) {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('current_streak, longest_streak')
        .eq('user_id', user.id)
        .single()

      const streakProfile = profile as { current_streak: number; longest_streak: number } | null

      if (streakProfile) {
        return {
          totalDays,
          completedDays,
          currentStreak: streakProfile.current_streak,
          longestStreak: streakProfile.longest_streak,
        }
      }
    }

    return {
      totalDays,
      completedDays,
      currentStreak: 0,
      longestStreak: 0,
    }
  }

  async bulkGetProgress(subscriptionId: string, scheduleIds: string[]): Promise<UserProgress[]> {
    if (scheduleIds.length === 0) return []

    const { data, error } = await this.supabase
      .from('user_progress')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .in('schedule_id', scheduleIds)

    if (error) throw new NetworkError(error.message, error)

    return (data ?? []).map(mapProgress)
  }
}
