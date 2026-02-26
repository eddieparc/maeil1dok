import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import AuthenticatedShell from './AuthenticatedShell'

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>)  {
  const supabase = await createClient()
  const repositories = createServerRepositories(supabase)
  const user = await repositories.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch displayName for Header
  let displayName = user.email?.split('@')[0] ?? '성도'
  try {
    const profile = await repositories.profile.getProfile(user.id)
    if (profile.nickname) displayName = profile.nickname
  } catch {
    // No profile row yet — use email prefix fallback
  }

  return (
    <AuthenticatedShell displayName={displayName} userId={user.id}>
      {children}
    </AuthenticatedShell>
  )
}
