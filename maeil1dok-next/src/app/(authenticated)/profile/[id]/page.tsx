export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import Container from '@/components/ui/Container'
import ProfilePage from '@/components/profile/ProfilePage'
import type { UserProfile } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProfileRoutePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const repositories = createServerRepositories(supabase)

  let profile: UserProfile | null = null
  try {
    profile = await repositories.profile.getProfile(id)
  } catch {
    profile = null
  }

  if (!profile) {
    return (
      <Container fullHeight className="py-6">
        <p className="text-sm text-gray-600">프로필을 찾을 수 없습니다.</p>
      </Container>
    )
  }

  const isOwnProfile = user.id === id

  if (!profile.isPublic && !isOwnProfile) {
    return (
      <Container fullHeight className="py-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">비공개 프로필</h1>
          <p className="mt-2 text-sm text-gray-500">이 사용자의 프로필은 비공개입니다.</p>
        </div>
      </Container>
    )
  }

  const followCounts = await repositories.profile.getFollowCounts(id)
  const isFollowing = isOwnProfile ? false : await repositories.profile.isFollowing(id)

  return (
    <ProfilePage
      profile={profile}
      followCounts={followCounts}
      isFollowing={isFollowing}
      isOwnProfile={isOwnProfile}
      currentUserId={user.id}
    />
  )
}
