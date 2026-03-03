'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/ui/ThemeToggle'

import { Menu, User, Settings, LogOut } from 'lucide-react'

interface HeaderClientProps {
  displayName: string
  userId: string
  avatarUrl?: string
  onHamburgerClick?: () => void
}

export default function HeaderClient({
  displayName,
  userId: _userId,
  avatarUrl,
  onHamburgerClick,
}: HeaderClientProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-default)] bg-[var(--color-bg-primary)]">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold text-[var(--color-text-primary)]">
          매일일독
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Hamburger */}
          <button
            onClick={onHamburgerClick}
            type="button"
            className="rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            aria-label="메뉴 열기"
            data-testid="hamburger-menu"
          >
            <Menu size={22} />
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((v) => !v)}
              type="button"
              className="rounded-xl p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              aria-label="프로필 메뉴"
              data-testid="profile-button"
            >
              <Avatar url={avatarUrl} name={displayName} size="sm" />
            </button>
            {isDropdownOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-1 shadow-lg"
                data-testid="profile-dropdown"
              >
                <div className="border-b border-[var(--color-border-default)] px-4 py-3">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{displayName}</p>
                </div>
                <div className="py-1">
                  <Link href={`/profile/${_userId}`} className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]" onClick={() => setIsDropdownOpen(false)}>
                    <User size={16} />
                    내 프로필
                  </Link>
                  <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]" onClick={() => setIsDropdownOpen(false)}>
                    <Settings size={16} />
                    계정 설정
                  </Link>
                  <Button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start rounded-none px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                    data-testid="signout-button"
                  >
                    <LogOut size={16} />
                    {isSigningOut ? '로그아웃 중...' : '로그아웃'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
