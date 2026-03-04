export const dynamic = 'force-dynamic'

import FriendsClient, { type FriendProfilePreview } from '@/components/friends/FriendsClient'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'

export default async function FriendsPage() {
  const supabase = await createClient()
  const repositories = createServerRepositories(supabase)

  let profiles: FriendProfilePreview[] = []

  try {
    const publicProfiles = await repositories.profile.getPublicProfiles(200)
    profiles = publicProfiles.map((profile) => ({
      userId: profile.userId,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
    }))
  } catch {
    profiles = []
  }

  return <FriendsClient profiles={profiles} />
}
