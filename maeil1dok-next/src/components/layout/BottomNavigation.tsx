'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  isActive: (pathname: string) => boolean
  icon: React.ReactNode
}

interface BottomNavigationProps {
  userId?: string
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: '홈',
    isActive: (pathname) => pathname === '/',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/reading',
    label: '읽기',
    isActive: (pathname) => pathname.startsWith('/reading'),
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528" />
      </svg>
    ),
  },
  {
    href: '/scoreboard',
    label: '랭킹',
    isActive: (pathname) => pathname.startsWith('/scoreboard'),
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3" y2="6" />
        <line x1="3" y1="12" x2="3" y2="12" />
        <line x1="3" y1="18" x2="3" y2="18" />
      </svg>
    ),
  },
  {
    href: '/groups',
    label: '그룹',
    isActive: (pathname) => pathname.startsWith('/groups'),
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

export default function BottomNavigation({ userId }: BottomNavigationProps) {
  const pathname = usePathname() ?? '/'
  const profileHref = userId ? `/profile/${userId}` : '/login'
  const profileLabel = userId ? '프로필' : '로그인'
  const profileIsActive = userId
    ? pathname.startsWith('/profile')
    : pathname.startsWith('/login')

  return (
    <div className="fixed right-0 bottom-0 left-0 z-[100] block border-t border-[var(--color-slate-200)] bg-[var(--color-bg-card)] pb-[env(safe-area-inset-bottom)] min-[1368px]:hidden">
      <nav className="mx-auto flex h-[60px] w-full max-w-full items-center justify-around px-2 md:h-[70px] md:max-w-[900px] md:px-4 lg:h-[80px] lg:max-w-[1200px] lg:px-6">
        {navItems.map((item) => {
          const active = item.isActive(pathname ?? '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-full flex-1 flex-col items-center justify-center gap-1 bg-transparent text-[var(--text-secondary)] no-underline transition-all duration-200 active:scale-95 md:gap-1.5 lg:gap-2"
              style={{ color: active ? 'var(--color-accent-primary)' : 'var(--text-secondary)' }}
            >
              <span className={active ? 'scale-110 transition-transform duration-200' : 'transition-transform duration-200'}>{item.icon}</span>
              <span className="text-[0.7rem] font-medium md:text-[0.8125rem] lg:text-[0.9375rem]">{item.label}</span>
            </Link>
          )
        })}

        <Link
          href={profileHref}
          className="flex h-full flex-1 flex-col items-center justify-center gap-1 bg-transparent text-[var(--text-secondary)] no-underline transition-all duration-200 active:scale-95 md:gap-1.5 lg:gap-2"
          style={{ color: profileIsActive ? 'var(--color-accent-primary)' : 'var(--text-secondary)' }}
        >
          <span className={profileIsActive ? 'scale-110 transition-transform duration-200' : 'transition-transform duration-200'}>
            {userId ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            )}
          </span>
          <span className="text-[0.7rem] font-medium md:text-[0.8125rem] lg:text-[0.9375rem]">{profileLabel}</span>
        </Link>
      </nav>
    </div>
  )
}
