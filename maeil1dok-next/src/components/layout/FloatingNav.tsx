'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, ClipboardList, Star } from 'lucide-react'
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
    href: '/calendar',
    label: '캘린더',
    testId: 'nav-calendar',
    isActive: (pathname: string) => pathname.startsWith('/calendar'),
    icon: <Calendar size={20} />,
  },
  {
    href: '/plan',
    label: '스케줄',
    testId: 'nav-schedule',
    isActive: (pathname: string) => pathname.startsWith('/plan') && !pathname.startsWith('/plans'),
    icon: <ClipboardList size={20} />,
  },
  {
    href: '/plans',
    label: '플랜',
    testId: 'nav-plans',
    isActive: (pathname: string) => pathname.startsWith('/plans'),
    icon: <Star size={20} />,
  },
]

export default function FloatingNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xs"
      style={{ bottom: 'max(8px, env(safe-area-inset-bottom))' }}
      data-testid="floating-nav"
    >
      <div className="flex items-center gap-0.5 rounded-2xl border border-[var(--color-border-default)]/60 bg-[var(--color-bg-primary)]/80 p-1.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]">
        {navItems.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-xs font-medium transition-all duration-200',
                active
                  ? 'bg-[var(--color-primary)] font-semibold text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-primary)]'
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
