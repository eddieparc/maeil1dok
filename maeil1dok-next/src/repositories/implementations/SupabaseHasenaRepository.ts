import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IHasenaRepository } from '@/repositories/interfaces/IHasenaRepository'
import type { HasenaRecord, HasenaSummary, VideoBibleIntro, VideoIntroProgress } from '@/types'
import { NetworkError, NotFoundError, AuthError } from '@/repositories/types/errors'

type DBRecord = Database['public']['Tables']['hasena_records']['Row']
type DBSummary = Database['public']['Tables']['hasena_summaries']['Row']
type DBVideoIntro = Database['public']['Tables']['video_bible_intros']['Row']
type DBVideoProgress = Database['public']['Tables']['user_video_intro_progress']['Row']

function mapRecord(row: DBRecord): HasenaRecord {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    isCompleted: row.is_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSummary(row: DBSummary): HasenaSummary {
  return {
    id: row.id,
    videoId: row.video_id,
    videoDate: row.video_date,
    title: row.title,
    summary: row.summary,
    transcript: row.transcript,
    modelUsed: row.model_used,
    isEdited: row.is_edited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVideoIntro(row: DBVideoIntro): VideoBibleIntro {
  return {
    id: row.id,
    planId: row.plan_id,
    book: row.book,
    urlLink: row.url_link,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVideoProgress(row: DBVideoProgress): VideoIntroProgress {
  return {
    id: row.id,
    userId: row.user_id,
    videoIntroId: row.video_intro_id,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SupabaseHasenaRepository implements IHasenaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new AuthError('Not authenticated')
    return user.id
  }

  async getRecordByDate(date: string): Promise<HasenaRecord | null> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await this.supabase
      .from('hasena_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapRecord(data) : null
  }

  async markHasenaComplete(date: string): Promise<HasenaRecord> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await (this.supabase
      .from('hasena_records') as any)
      .upsert({ user_id: userId, date, is_completed: true }, { onConflict: 'user_id,date' })
      .select()
      .single()
    
    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to mark hasena complete')
    return mapRecord(data)
  }

  async markHasenaIncomplete(date: string): Promise<HasenaRecord> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await (this.supabase
      .from('hasena_records') as any)
      .upsert({ user_id: userId, date, is_completed: false }, { onConflict: 'user_id,date' })
      .select()
      .single()
    
    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to mark hasena incomplete')
    return mapRecord(data)
  }

  async getRecentRecords(limit = 10): Promise<HasenaRecord[]> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await this.supabase
      .from('hasena_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit)
    
    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapRecord)
  }

  async getSummaryByDate(date: string): Promise<HasenaSummary | null> {
    const { data, error } = await this.supabase
      .from('hasena_summaries')
      .select('*')
      .eq('video_date', date)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapSummary(data) : null
  }

  async getRecentSummaries(limit = 10): Promise<HasenaSummary[]> {
    const { data, error } = await this.supabase
      .from('hasena_summaries')
      .select('*')
      .order('video_date', { ascending: false })
      .limit(limit)
    
    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapSummary)
  }

  async getVideoIntroByBook(planId: number, book: string): Promise<VideoBibleIntro | null> {
    const { data, error } = await this.supabase
      .from('video_bible_intros')
      .select('*')
      .eq('plan_id', planId)
      .eq('book', book)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapVideoIntro(data) : null
  }

  async getVideoIntroProgress(videoIntroId: string): Promise<VideoIntroProgress | null> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await this.supabase
      .from('user_video_intro_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('video_intro_id', videoIntroId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapVideoProgress(data) : null
  }

  async markVideoIntroComplete(videoIntroId: string): Promise<VideoIntroProgress> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await (this.supabase
      .from('user_video_intro_progress') as any)
      .upsert({
        user_id: userId,
        video_intro_id: videoIntroId,
        is_completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,video_intro_id' })
      .select()
      .single()
    
    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NetworkError('Failed to mark video intro complete')
    return mapVideoProgress(data)
  }
}
