'use client'

import { useState } from 'react'
import HeaderClient from '@/components/layout/HeaderClient'
import FloatingNav from '@/components/layout/FloatingNav'
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
    <div className="min-h-screen flex flex-col">
      <HeaderClient
        displayName={displayName}
        userId={userId}
        avatarUrl={avatarUrl}
        onHamburgerClick={() => setIsMenuOpen(true)}
      />
      <main className="flex-1 pb-20">
        {/* pb-20 = 80px bottom padding to prevent FloatingNav overlap */}
        {children}
      </main>
      <FloatingNav />
      <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  )
}
