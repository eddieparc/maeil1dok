import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import HeaderClient from './HeaderClient'

export default async function Header() {
  const supabase = await createClient()
  const repos = createServerRepositories(supabase)

  const user = await repos.auth.getUser()
  if (!user) return null

  // getProfile() throws NotFoundError if no profile row exists
  // Fall back to email prefix or '성도'
  let displayName = user.email?.split('@')[0] ?? '성도'
  let avatarUrl: string | undefined
  try {
    const profile = await repos.profile.getProfile(user.id)
    if (profile.nickname) displayName = profile.nickname
    avatarUrl = profile.avatarUrl
  } catch {
    // No profile row yet — use email prefix fallback
  }

  return <HeaderClient displayName={displayName} userId={user.id} avatarUrl={avatarUrl} />
}
