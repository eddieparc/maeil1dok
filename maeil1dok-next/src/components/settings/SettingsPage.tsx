'use client'

import { useState } from 'react'
import type { User, UserProfile } from '@/types'
import NotificationsSection from './NotificationsSection'
import ProfileSection from './ProfileSection'
import SecuritySection from './SecuritySection'

interface SettingsPageProps {
  user: User
  profile: UserProfile | null
}

type Section = 'profile' | 'security' | 'notifications'

export default function SettingsPage({ user, profile }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<Section>('profile')

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900">계정 설정</h1>

      <div className="mt-5 border-b border-gray-200">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`pb-2 text-sm font-medium ${
              activeSection === 'profile'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500'
            }`}
          >
            프로필
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('security')}
            className={`pb-2 text-sm font-medium ${
              activeSection === 'security'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500'
            }`}
          >
            보안
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('notifications')}
            className={`pb-2 text-sm font-medium ${
              activeSection === 'notifications'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500'
            }`}
          >
            알림
          </button>
        </div>
      </div>

      <div className="mt-5">
        {activeSection === 'profile' && <ProfileSection user={user} profile={profile} />}
        {activeSection === 'security' && <SecuritySection user={user} />}
        {activeSection === 'notifications' && <NotificationsSection user={user} />}
      </div>
    </main>
  )
}
