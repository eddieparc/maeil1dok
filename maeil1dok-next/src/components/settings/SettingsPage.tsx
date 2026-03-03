'use client'

import { useState } from 'react'
import type { User, UserIdentity, UserProfile } from '@/types'
import { Container, PageHeader, Tabs, TabList, Tab, TabPanel, ThemeToggle } from '@/components/ui'
import NotificationsSection from './NotificationsSection'
import ProfileSection from './ProfileSection'
import SecuritySection from './SecuritySection'
interface SettingsPageProps {
  user: User
  profile: UserProfile | null
  identities: UserIdentity[]
}

type Section = 'profile' | 'security' | 'notifications' | 'appearance'

export default function SettingsPage({ user, profile, identities }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<string>('profile')

  return (
    <Container maxWidth="lg" className="py-6">
      <PageHeader title="계정 설정" className="mb-6" />

      <Tabs activeTab={activeSection} onTabChange={setActiveSection}>
        <TabList>
          <Tab id="profile" label="프로필" />
          <Tab id="security" label="보안" />
          <Tab id="notifications" label="알림" />
          <Tab id="appearance" label="외관" />
        </TabList>
        
        <div className="mt-6">
          {activeSection === 'profile' && (
            <TabPanel id="profile">
              <ProfileSection user={user} profile={profile} />
            </TabPanel>
          )}
          {activeSection === 'security' && (
            <TabPanel id="security">
              <SecuritySection user={user} identities={identities} />
            </TabPanel>
          )}
          {activeSection === 'notifications' && (
            <TabPanel id="notifications">
              <NotificationsSection user={user} />
            </TabPanel>
          )}
          {activeSection === 'appearance' && (
            <TabPanel id="appearance">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    테마 설정
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    라이트 모드, 다크 모드 또는 시스템 설정을 따르도록 선택할 수 있습니다.
                  </p>
                  <ThemeToggle />
                </div>
              </div>
            </TabPanel>
          )}
        </div>
      </Tabs>
    </Container>
  )
}
