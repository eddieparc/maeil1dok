import { redirect } from 'next/navigation'
import SettingsPage from '@/components/settings/SettingsPage'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import type { UserIdentity } from '@/types'

export default async function Page() {
  const supabase = await createClient()
  const repos = createServerRepositories(supabase)
  const user = await repos.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let profile = null
  let identities: UserIdentity[] = []
  try {
    profile = await repos.profile.getProfile(user.id)
  } catch {
    profile = null
  }

  try {
    identities = await repos.auth.getUserIdentities()
  } catch {
    identities = []
  }

  return <SettingsPage user={user} profile={profile} identities={identities} />
}
