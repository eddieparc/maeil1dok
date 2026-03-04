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
      <main className="flex-1 pb-20">
        {children}
      </main>
      <BottomNavigation userId={userId} />
      <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}
