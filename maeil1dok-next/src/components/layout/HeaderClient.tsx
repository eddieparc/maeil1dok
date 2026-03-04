'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ui/ThemeToggle'

import { Menu } from 'lucide-react'

interface HeaderClientProps {
  displayName: string
  userId: string
  avatarUrl?: string
  onHamburgerClick?: () => void
}

export default function HeaderClient({
  displayName,
  userId,
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

  const closeDropdown = () => {
    setIsDropdownOpen(false)
  }

  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/90"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[768px] items-center justify-between px-4 tracking-[-0.05em]">
        <Link href="/" className="ml-[5px] block cursor-pointer" aria-label="홈으로 이동">
          <img src="/images/로고_투명.png" alt="매일일독" className="h-5 w-auto transition duration-200 dark:brightness-0 dark:invert" loading="lazy" />
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button
            onClick={onHamburgerClick}
            type="button"
            className="-m-2 flex items-center justify-center rounded-md bg-transparent p-1.5 text-[var(--color-text-primary)] transition duration-200 hover:opacity-70 active:scale-95"
            aria-label="메뉴 열기"
            data-testid="hamburger-menu"
          >
            <Menu size={24} />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((v) => !v)}
              type="button"
              className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full border-2 border-transparent bg-transparent transition duration-200 hover:scale-105 hover:border-[var(--color-accent-primary)] sm:h-8 sm:w-8"
              aria-label="프로필 메뉴"
              data-testid="profile-button"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </button>

            <div
              className={`absolute right-0 top-full z-50 mt-2 w-[220px] overflow-hidden rounded-lg border border-[var(--color-slate-200)] bg-[var(--color-bg-card)] shadow-lg transition-all duration-200 ease-in-out ${
                isDropdownOpen ? 'translate-y-0 opacity-100' : '-translate-y-2.5 pointer-events-none opacity-0'
              }`}
              data-testid="profile-dropdown"
            >
              <div className="bg-[var(--color-slate-50)] px-4 py-3">
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{displayName}</p>
              </div>
              <div className="h-px bg-[var(--color-slate-200)]" />
              <Link href={`/profile/${userId}`} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition duration-150 hover:bg-[var(--color-slate-100)]" onClick={closeDropdown}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                내 프로필
              </Link>
              <Link href="/plans" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition duration-150 hover:bg-[var(--color-slate-100)]" onClick={closeDropdown}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                플랜 관리
              </Link>
              <Link href="/plan" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition duration-150 hover:bg-[var(--color-slate-100)]" onClick={closeDropdown}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 5H7C6.46957 5 5.96086 5.21071 5.58579 5.58579C5.21071 5.96086 5 6.46957 5 7V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V7C19 6.46957 18.7893 5.96086 18.4142 5.58579C18.0391 5.21071 17.5304 5 17 5H15M9 5C9 5.53043 9.21071 6.03914 9.58579 6.41421C9.96086 6.78929 10.4696 7 11 7H13C13.5304 7 14.0391 6.78929 14.4142 6.41421C14.7893 6.03914 15 5.53043 15 5M9 5C9 4.46957 9.21071 3.96086 9.58579 3.58579C9.96086 3.21071 10.4696 3 11 3H13C13.5304 3 14.0391 3.21071 14.4142 3.58579C14.7893 3.96086 15 4.46957 15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 12H15M9 16H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                성경통독표
              </Link>
              <Link href="/groups" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition duration-150 hover:bg-[var(--color-slate-100)]" onClick={closeDropdown}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                그룹
              </Link>
              <Link href="/friends" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition duration-150 hover:bg-[var(--color-slate-100)]" onClick={closeDropdown}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                친구
              </Link>
              <Link href="/settings" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] transition duration-150 hover:bg-[var(--color-slate-100)]" onClick={closeDropdown}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                설정
              </Link>
              <div className="h-px bg-[var(--color-slate-200)]" />
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#dc2626] transition duration-150 hover:bg-[var(--color-slate-100)] disabled:opacity-70"
                data-testid="signout-button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isSigningOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
