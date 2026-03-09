'use client'

import Link from 'next/link'

export type BibleSubpageTab = 'bookmarks' | 'notes' | 'highlights' | 'history'

const ALL_TABS = [
  { href: '/bible/bookmarks', label: '북마크', key: 'bookmarks' },
  { href: '/bible/notes', label: '노트', key: 'notes' },
  { href: '/bible/highlights', label: '하이라이트', key: 'highlights' },
  { href: '/bible/history', label: '기록', key: 'history' },
] as const

interface BibleSubpageTabsProps {
  current: BibleSubpageTab
}

export function BibleSubpageTabs({ current }: BibleSubpageTabsProps) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-2" aria-label="성경 활동 네비게이션">
      {ALL_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={[
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            tab.key === current
              ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
          ].join(' ')}
          aria-current={tab.key === current ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
