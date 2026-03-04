'use client'

import { useState } from 'react'
import HeaderClient from '@/components/layout/HeaderClient'
import BottomNavigation from '@/components/layout/BottomNavigation'
import Menu from '@/components/layout/Menu'

interface AuthenticatedShellProps {
  children: React.ReactNode
  displayName: string
  userId: string
  avatarUrl?: string
}

export default function AuthenticatedShell({
  children,
  displayName,
  userId,
  avatarUrl,
}: AuthenticatedShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-primary)]">
      <HeaderClient
        displayName={displayName}
        userId={userId}
        avatarUrl={avatarUrl}
        onHamburgerClick={() => setIsMenuOpen(true)}
      />
      <main className="flex-1 bg-[var(--color-bg-primary)] px-4 pb-[calc(60px+env(safe-area-inset-bottom))] md:px-6 lg:px-8">
        <div className="mx-auto w-full md:max-w-[900px] lg:max-w-[1200px]">
          {children}
        </div>
      </main>
      <BottomNavigation userId={userId} />
      <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}
