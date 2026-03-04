'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/',
    label: '홈',
    testId: 'nav-home',
    isActive: (pathname: string) => pathname === '/',
    icon: <Home size={20} />,
  },
  {
    href: '/bible',
    label: '성경',
    testId: 'nav-bible',
    isActive: (pathname: string) => pathname.startsWith('/bible'),
    icon: <BookOpen size={20} />,
  },
  {
    href: '/plan',
    label: '스케줄',
    testId: 'nav-schedule',
    isActive: (pathname: string) => pathname.startsWith('/plan') && !pathname.startsWith('/plans'),
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function FloatingNav() {
  const pathname = usePathname() ?? '/'

  return (
    <nav
      className="fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2"
      style={{ bottom: 'max(8px, env(safe-area-inset-bottom))' }}
      data-testid="floating-nav"
    >
      <div
        className={cn(
          'flex items-center gap-0.5 rounded-[20px] p-1.5',
          /* Glassmorphism - light */
          'border border-white/50 bg-white/75 backdrop-blur-[20px]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.5)]',
          /* Glassmorphism - dark */
          'dark:border-white/[0.08] dark:bg-[rgba(36,36,36,0.88)]',
          'dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]',
        )}
      >
        {navItems.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                'flex flex-1 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium whitespace-nowrap transition-all duration-200',
                active
                  ? 'bg-[var(--color-accent-primary)] font-semibold text-white shadow-[0_2px_8px_rgba(75,159,126,0.3)] dark:text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[rgba(75,159,126,0.08)] hover:text-[var(--color-accent-primary)]',
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
