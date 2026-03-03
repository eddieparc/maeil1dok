'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, ClipboardList, Star } from 'lucide-react'

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
      <div className="flex items-center gap-0.5 p-1.5 bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]">
        {navItems.map((item) => {
          const active = item.isActive(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl transition-all duration-200 text-xs font-medium',
                active
                  ? 'bg-indigo-600 text-white font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50',
              ].join(' ')}
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
