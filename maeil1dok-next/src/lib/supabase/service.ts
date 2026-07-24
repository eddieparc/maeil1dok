import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Server-only Supabase client backed by the service-role key.
 *
 * Used by trusted backend paths (e.g. authorized cron fanout) that must read or
 * write rows across users without a signed-in session. The service role bypasses
 * row-level security, so callers MUST authorize the request before creating this
 * client and MUST never return credentials, keys, or token values to clients.
 *
 * Throws when either required environment variable is missing so misconfigured
 * deployments fail loudly (alertable) instead of silently no-oping.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service credentials are not configured')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
