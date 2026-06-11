'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CardItem {
  id: string
  testId: string
  title: string
  description: string
  icon: ReactNode
  href?: string
  disabled?: boolean
}

interface QuickAccessGridProps {
  userId?: string
}

function IconBookOpen() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m9 8 6 4-6 4Z" />
    </svg>
  )
}

function IconMusic() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

const cards = (userId?: string): CardItem[] => [
  {
    id: 'plan',
    testId: 'card-plan',
    title: '통독표',
    description: '전체 계획 보기',
    icon: <IconBookOpen />,
    href: '/plan',
  },
  {
    id: 'plans',
    testId: 'card-plans',
    title: '플랜 관리',
    description: '구독과 표시 설정',
    icon: <IconCalendar />,
    href: '/plans',
  },
  {
    id: 'intro',
    testId: 'card-intro',
    title: '개론 영상',
    description: '깊이 있는 이해',
    icon: <IconVideo />,
    href: '/intro',
  },
  {
    id: 'hasena',
    testId: 'card-hasena',
    title: '하세나하시조',
    description: '오늘의 영상',
    icon: <IconMusic />,
    href: '/hasena',
  },
  {
    id: 'community',
    testId: 'card-community',
    title: '커뮤니티',
    description: '함께 읽는 기쁨',
    icon: <IconUsers />,
    href: '/groups',
  },
  {
    id: 'profile',
    testId: 'card-profile',
    title: '내 활동',
    description: '기록과 통계',
    icon: <IconActivity />,
    href: userId ? `/profile/${userId}` : '/login',
  },
]

export default function QuickAccessGrid({ userId }: QuickAccessGridProps) {
  return (
    <section data-testid="quick-access-grid" className="mb-4">
      <h2
        className="mb-3 text-[22px] font-medium text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
        style={{ fontFamily: 'var(--font-family-serif)' }}
      >
        Explore
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cards(userId).map((card) => {
          return (
            <Link
              key={card.id}
              href={card.href!}
              data-testid={card.testId}
              className="group"
            >
              <div
                className={cn(
                  'rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-4 transition-all duration-200',
                  'group-hover:-translate-y-0.5 group-hover:border-[var(--color-ink)] group-hover:shadow-[var(--shadow-card)]',
                )}
              >
                <div className="mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-faint)] text-[var(--color-brand)] transition-colors">
                    {card.icon}
                  </div>
                </div>
                <p className="text-[15px] font-semibold text-[var(--color-ink)] -tracking-[0.012em]">{card.title}</p>
                <p className="mt-1 text-[12px] text-[var(--color-mute)] -tracking-[0.005em]">{card.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
