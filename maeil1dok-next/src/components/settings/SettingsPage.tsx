'use client'

import type { User, UserIdentity, UserProfile } from '@/types'
import NotificationsSection from './NotificationsSection'
import ProfileSection from './ProfileSection'
import SecuritySection from './SecuritySection'

interface SettingsPageProps {
  user: User
  profile: UserProfile | null
  identities: UserIdentity[]
}

export default function SettingsPage({ user, profile, identities }: SettingsPageProps) {
  return (
    <div className="mx-auto w-full max-w-[600px] py-6">
      <header className="mb-6 px-1">
        <h1 className="text-xl font-semibold text-[var(--color-slate-800)]">계정 설정</h1>
      </header>

      <div className="space-y-8">
        <ProfileSection user={user} profile={profile} />
        <NotificationsSection user={user} />
        <SecuritySection user={user} identities={identities} />
      </div>
    </div>
  )
}
