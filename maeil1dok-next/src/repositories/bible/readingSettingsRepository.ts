import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type SupabaseDB = SupabaseClient<Database>

type ReadingSettingsRow = Database['public']['Tables']['user_reading_settings']['Row']
type ReadingSettingsUpdate = Database['public']['Tables']['user_reading_settings']['Update']

export type RepositoryResult<T> = Promise<{ data: T | null; error: Error | null }>

export async function getSettings(
  supabase: SupabaseDB,
  userId: string
): RepositoryResult<ReadingSettingsRow> {
  const { data, error } = await supabase
    .from('user_reading_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error?.code === 'PGRST116') {
    return { data: null, error: null }
  }

  return { data, error }
}

export async function updateSettings(
  supabase: SupabaseDB,
  userId: string,
  input: ReadingSettingsUpdate
): RepositoryResult<ReadingSettingsRow> {
  const { data, error } = await supabase
    .from('user_reading_settings')
    .update({ ...input, updated_at: new Date().toISOString() } as never)
    .eq('user_id', userId)
    .select('*')
    .single()

  return { data, error }
}
