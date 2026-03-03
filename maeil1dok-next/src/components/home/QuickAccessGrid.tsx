'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Card, Badge } from '@/components/ui'
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
  userId: string
}

function IconBookOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </svg>
  )
}

function IconMusic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

const cards = (userId: string): CardItem[] => [
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
    description: '나의 플랜 설정',
    icon: <IconSettings />,
    href: '/plans',
  },
  {
    id: 'intro',
    testId: 'card-intro',
    title: '성경개론',
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
    id: 'bible',
    testId: 'card-bible',
    title: '성경본문',
    description: '오늘의 말씀',
    icon: <IconBookOpen />,
    href: '/bible',
  },
  {
    id: 'catchup',
    testId: 'card-catchup',
    title: '캐치업',
    description: '놓친 부분 읽기',
    icon: <IconActivity />,
    href: '/catchup',
  },
  {
    id: 'profile',
    testId: 'card-profile',
    title: '프로필',
    description: '내 정보 관리',
    icon: <IconUsers />,
    href: `/profile/${userId}`,
  },
  {
    id: 'community',
    testId: 'card-community',
    title: '커뮤니티',
    description: '함께 읽는 기쁨',
    icon: <IconUsers />,
    disabled: true,
  },
  {
    id: 'activity',
    testId: 'card-activity',
    title: '내 활동',
    description: '기록과 통계',
    icon: <IconActivity />,
    disabled: true,
  },
]

export default function QuickAccessGrid({ userId }: QuickAccessGridProps) {
  return (
    <section data-testid="quick-access-grid" className="px-4 pb-4">
      <h2
        className="mb-3 text-lg font-bold text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-family-reading)' }}
      >
        Explore
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cards(userId).map((card) => {
          if (card.disabled) {
            return (
              <Card
                key={card.id}
                data-testid={card.testId}
                className="relative p-4 opacity-50 pointer-events-none cursor-not-allowed"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                  {card.icon}
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{card.title}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{card.description}</p>
                <Badge variant="default" size="sm" className="absolute top-3 right-3 bg-[var(--color-border-light)] text-[var(--color-text-muted)] text-[10px] px-2 py-0.5">
                  준비 중
                </Badge>
              </Card>
            )
          }

          return (
            <Link
              key={card.id}
              href={card.href!}
              data-testid={card.testId}
              className="group"
            >
              <Card className="p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-md)]">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                  {card.icon}
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{card.title}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{card.description}</p>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
