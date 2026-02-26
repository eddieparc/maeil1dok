import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type TypedSupabaseClient = SupabaseClient<Database>

// Placeholder for repository instances — implementations added in Wave 4
export interface ServerRepositories {
  // Will be populated as repositories are implemented
  [key: string]: unknown
}

export interface ClientRepositories {
  // Will be populated as repositories are implemented
  [key: string]: unknown
}

/**
 * Creates server-side repositories (for use in Server Components and Route Handlers)
 * @param client - Supabase server client
 */
export function createServerRepositories(client: TypedSupabaseClient): ServerRepositories {
  return {}
}

/**
 * Creates client-side repositories (for use in Client Components)
 * @param client - Supabase browser client
 */
export function createClientRepositories(client: TypedSupabaseClient): ClientRepositories {
  return {}
}
