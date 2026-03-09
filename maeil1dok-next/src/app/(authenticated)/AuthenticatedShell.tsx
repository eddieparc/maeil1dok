'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname() ?? '/'
  const isBibleRoute = pathname.startsWith('/bible')

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-primary)]">
      <HeaderClient
        displayName={displayName}
        userId={userId}
        avatarUrl={avatarUrl}
        onHamburgerClick={() => setIsMenuOpen(true)}
      />
      <main className={`flex-1 bg-[var(--color-bg-primary)] px-4 md:px-6 lg:px-8 ${isBibleRoute ? 'pb-0' : 'pb-[calc(80px+env(safe-area-inset-bottom))]'}`}>
        <div className="mx-auto w-full md:max-w-[900px] lg:max-w-[1200px]">
          {children}
        </div>
      </main>
      {!isBibleRoute && <FloatingNav userId={userId} />}
      <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} userId={userId} />
    </div>
  )
}
