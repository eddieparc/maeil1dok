'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Sun, Moon, Monitor, Menu as MenuIcon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import BottomNavigation from '@/components/layout/BottomNavigation'
import MenuPanel from '@/components/layout/Menu'

interface HomeShellProps {
  children: React.ReactNode
  userId?: string
}

function HomeThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [direction, setDirection] = useState<'enter' | 'leave'>('enter')

  const handleToggle = useCallback(() => {
    setDirection('leave')
    setIsTransitioning(true)

    setTimeout(() => {
      if (theme === 'light') setTheme('dark')
      else if (theme === 'dark') setTheme('system')
      else setTheme('light')

      setDirection('enter')
      setTimeout(() => setIsTransitioning(false), 200)
    }, 200)
  }, [theme, setTheme])

  const iconStyle: React.CSSProperties = isTransitioning
    ? {
        transition: 'all 0.2s ease',
        opacity: 0,
        transform:
          direction === 'leave'
            ? 'rotate(90deg) scale(0.8)'
            : 'rotate(-90deg) scale(0.8)',
      }
    : {
        transition: 'all 0.2s ease',
        opacity: 1,
        transform: 'rotate(0deg) scale(1)',
      }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`현재 테마: ${theme}. 클릭하여 전환`}
      className={cn(
        'flex items-center justify-center p-2',
        'text-[var(--color-text-primary)]',
        'transition-opacity duration-200',
        'hover:opacity-70 active:scale-95',
      )}
    >
      <span style={iconStyle}>
        {theme === 'light' && <Moon className="h-5 w-5" />}
        {theme === 'dark' && <Sun className="h-5 w-5" />}
        {theme === 'system' && <Monitor className="h-5 w-5" />}
      </span>
    </button>
  )
}

export default function HomeShell({ children, userId }: HomeShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  return (
    <div className="sanctuary-theme relative min-h-screen font-[var(--font-family-ui)] text-[var(--color-text-primary)] antialiased leading-relaxed">
      {/* Background gradient pattern */}
      <div
        className="sanctuary-bg pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      />

      {/* Content container */}
      <div

        className="relative z-10 mx-auto min-h-screen max-w-3xl"
        style={{ padding: '0 1rem calc(max(3rem, 6vh) + env(safe-area-inset-bottom))' }}
      >
        {/* Sticky Header */}
        <header className="sticky-header sticky top-0 z-30 mt-2 mb-1 flex items-center justify-between rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-3 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <Link href="/" className="block h-6">
            <Image
              src="/images/로고_투명.png"
              alt="매일일독"
              width={96}
              height={24}
              className="h-full w-auto object-contain dark:brightness-0 dark:invert dark:opacity-90"
              priority
            />
          </Link>
          <div className="flex items-center gap-1">
            <HomeThemeToggle />
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className={cn(
                'flex items-center justify-center p-2 -mr-2',
                'text-[var(--color-text-primary)]',
                'transition-opacity duration-200',
                'hover:opacity-70',
              )}
              aria-label="메뉴 열기"
            >
              <MenuIcon size={24} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex flex-col gap-4 pt-2">
          {children}
        </main>
      </div>

      <BottomNavigation userId={userId} />

      {/* Menu Panel */}
      <MenuPanel isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} userId={userId} />
    </div>
  )
}
