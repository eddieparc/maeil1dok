import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { IProfileRepository } from '@/repositories/interfaces/IProfileRepository'
import type { UserProfile, UserReadingSettings, UserReadingPosition, UserFollow, FollowCounts } from '@/types'
import { NotFoundError, NetworkError, AuthError } from '@/repositories/types/errors'

type DBProfile = Database['public']['Tables']['profiles']['Row']
type DBReadingSettings = Database['public']['Tables']['user_reading_settings']['Row']
type DBReadingPosition = Database['public']['Tables']['user_reading_positions']['Row']

function mapProfile(row: DBProfile): UserProfile {
  return {
    userId: row.user_id,
    nickname: row.nickname,
    bio: row.bio,
    totalCompletedDays: row.total_completed_days,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapReadingSettings(row: DBReadingSettings): UserReadingSettings {
  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme as 'light' | 'dark' | 'system',
    fontFamily: row.font_family,
    fontSize: row.font_size,
    fontWeight: row.font_weight,
    lineHeight: Number(row.line_height),
    textAlign: row.text_align,
    verseJoining: row.verse_joining,
    showVerseNumbers: row.show_verse_numbers,
    showDescription: row.show_description,
    showCrossRef: row.show_cross_ref,
    highlightNames: row.highlight_names,
    showFootnotes: row.show_footnotes,
    tongdokAutoComplete: row.tongdok_auto_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapReadingPosition(row: DBReadingPosition): UserReadingPosition {
  return {
    id: row.id,
    userId: row.user_id,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    scrollPosition: Number(row.scroll_position),
    version: row.version,
    updatedAt: row.updated_at,
  }
}

export class SupabaseProfileRepository implements IProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new AuthError('Not authenticated')
    return user.id
  }

  async getProfile(userId?: string): Promise<UserProfile> {
    const targetUserId = userId ?? await this.getCurrentUserId()

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!data) throw new NotFoundError('Profile not found', 'profiles')
    return mapProfile(data)
  }

  async updateProfile(data: Partial<Pick<UserProfile, 'nickname' | 'bio' | 'isPublic'>>): Promise<UserProfile> {
    const userId = await this.getCurrentUserId()
    const updateData: Record<string, unknown> = {}
    if (data.nickname !== undefined) updateData.nickname = data.nickname
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.isPublic !== undefined) updateData.is_public = data.isPublic

    const { data: updated, error } = await (this.supabase
      .from('profiles') as any)
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Profile not found')
    return mapProfile(updated)
  }

  async updatePublicStatus(isPublic: boolean): Promise<void> {
    const userId = await this.getCurrentUserId()
    const { error } = await (this.supabase
      .from('profiles') as any)
      .update({ is_public: isPublic })
      .eq('user_id', userId)

    if (error) throw new NetworkError(error.message, error)
  }

  async getPublicProfiles(limit = 20): Promise<UserProfile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('is_public', true)
      .order('total_completed_days', { ascending: false })
      .limit(limit)

    if (error) throw new NetworkError(error.message, error)
    return (data ?? []).map(mapProfile)
  }

  async getReadingSettings(): Promise<UserReadingSettings> {
    const userId = await this.getCurrentUserId()

    const { data, error } = await this.supabase
      .from('user_reading_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw new NetworkError(error.message, error)

    if (!data) {
      // Create default settings
      const { data: created, error: createError } = await (this.supabase
        .from('user_reading_settings') as any)
        .insert({ user_id: userId })
        .select()
        .single()

      if (createError) throw new NetworkError(createError.message, createError)
      if (!created) throw new NetworkError('Failed to create reading settings')
      return mapReadingSettings(created)
    }

    return mapReadingSettings(data)
  }

  async updateReadingSettings(
    data: Partial<Omit<UserReadingSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<UserReadingSettings> {
    const userId = await this.getCurrentUserId()

    const updateData: Record<string, unknown> = {}
    if (data.theme !== undefined) updateData.theme = data.theme
    if (data.fontFamily !== undefined) updateData.font_family = data.fontFamily
    if (data.fontSize !== undefined) updateData.font_size = data.fontSize
    if (data.fontWeight !== undefined) updateData.font_weight = data.fontWeight
    if (data.lineHeight !== undefined) updateData.line_height = data.lineHeight
    if (data.textAlign !== undefined) updateData.text_align = data.textAlign
    if (data.verseJoining !== undefined) updateData.verse_joining = data.verseJoining
    if (data.showVerseNumbers !== undefined) updateData.show_verse_numbers = data.showVerseNumbers
    if (data.showDescription !== undefined) updateData.show_description = data.showDescription
    if (data.showCrossRef !== undefined) updateData.show_cross_ref = data.showCrossRef
    if (data.highlightNames !== undefined) updateData.highlight_names = data.highlightNames
    if (data.showFootnotes !== undefined) updateData.show_footnotes = data.showFootnotes
    if (data.tongdokAutoComplete !== undefined) updateData.tongdok_auto_complete = data.tongdokAutoComplete

    const { data: updated, error } = await (this.supabase
      .from('user_reading_settings') as any)
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NotFoundError('Reading settings not found')
    return mapReadingSettings(updated)
  }

  async getReadingPosition(): Promise<UserReadingPosition | null> {
    const userId = await this.getCurrentUserId()

    const { data, error } = await this.supabase
      .from('user_reading_positions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new NetworkError(error.message, error)
    }
    return data ? mapReadingPosition(data) : null
  }

  async updateReadingPosition(
    data: Partial<Omit<UserReadingPosition, 'id' | 'userId' | 'updatedAt'>>
  ): Promise<UserReadingPosition> {
    const userId = await this.getCurrentUserId()

    const upsertData: Record<string, unknown> = { user_id: userId }
    if (data.book !== undefined) upsertData.book = data.book
    if (data.chapter !== undefined) upsertData.chapter = data.chapter
    if (data.verse !== undefined) upsertData.verse = data.verse
    if (data.scrollPosition !== undefined) upsertData.scroll_position = data.scrollPosition
    if (data.version !== undefined) upsertData.version = data.version

    const { data: updated, error } = await (this.supabase
      .from('user_reading_positions') as any)
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw new NetworkError(error.message, error)
    if (!updated) throw new NetworkError('Failed to update reading position')
    return mapReadingPosition(updated)
  }

  async followUser(targetUserId: string): Promise<void> {
    throw new Error('not implemented')
  }

  async unfollowUser(targetUserId: string): Promise<void> {
    throw new Error('not implemented')
  }

  async getFollowers(userId: string, limit?: number, offset?: number): Promise<UserFollow[]> {
    throw new Error('not implemented')
  }

  async getFollowing(userId: string, limit?: number, offset?: number): Promise<UserFollow[]> {
    throw new Error('not implemented')
  }

  async getFollowCounts(userId: string): Promise<FollowCounts> {
    throw new Error('not implemented')
  }

  async isFollowing(targetUserId: string): Promise<boolean> {
    throw new Error('not implemented')
  }
}
