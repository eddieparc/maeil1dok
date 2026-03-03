'use client'

import { useState } from 'react'
import type { User, UserIdentity, UserProfile } from '@/types'
import { Container, PageHeader, Tabs, TabList, Tab, TabPanel } from '@/components/ui'
import NotificationsSection from './NotificationsSection'
import ProfileSection from './ProfileSection'
import SecuritySection from './SecuritySection'
interface SettingsPageProps {
  user: User
  profile: UserProfile | null
  identities: UserIdentity[]
}

type Section = 'profile' | 'security' | 'notifications'

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
        </div>
      </Tabs>
    </Container>
  )
}
