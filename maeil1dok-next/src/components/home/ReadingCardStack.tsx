'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { UserProgress } from '@/types/progress'
import type { DailySchedule } from '@/types/schedule'
import { cn } from '@/lib/utils'
import { determineCardType, type PastIncompleteData } from './ReadingCardStack.utils'
import { HasenaCard } from './HasenaCard'
import { IntroCard } from './IntroCard'

interface ReadingCardStackProps {
  isAuthenticated?: boolean
  todaySchedule: DailySchedule | null
  todayProgress: UserProgress | null
  pastIncomplete: PastIncompleteData | null
  hasenaCompleted?: boolean
  introAvailable?: boolean
  introCompleted?: boolean
}

interface CardProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  'data-testid'?: string
}

function ReadingCard({ children, onClick, className = '', ...props }: CardProps) {
  const isInteractive = typeof onClick === 'function'

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      {...(isInteractive
        ? {
            onClick,
            onKeyDown: handleKeyDown,
            role: 'button' as const,
            tabIndex: 0,
          }
        : {})}
      className={cn(
        'relative flex w-full flex-col justify-center overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-card)] transition-all duration-300',
        isInteractive && 'cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]',
        className,
      )}
      data-testid="reading-card"
      {...props}
    >
      {children}
    </div>
  )
}

function CardLabel({ label, tone = 'default' }: { label: string; tone?: 'default' | 'warning' | 'success' }) {
  const toneClassName = {
    default: 'bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]',
        toneClassName,
      )}
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {label}
    </span>
  )
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ marginLeft: 4 }}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function StartButton({ label, variant }: { label: string; variant?: 'default' | 'secondary' }) {
  return (
    <span
      className={cn(
        'mt-4 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-secondary)] hover:shadow-[var(--shadow-card)]',
        variant === 'secondary' && 'text-[var(--color-text-secondary)]',
      )}
    >
      {label}
      <ArrowIcon />
    </span>
  )
}

function LoginCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ReadingCard
      onClick={onNavigate}
      className="text-[var(--color-text-primary)]"
      data-testid="login-card"
    >
      <CardLabel label="WELCOME" />
      <h2
        className="mt-2 leading-tight font-light text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}
      >
        로그인하고
        <br />
        <strong className="font-bold">시작하세요</strong>
      </h2>
      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">나만의 통독 기록을 관리할 수 있습니다</div>
      <StartButton label="로그인 / 회원가입" />
    </ReadingCard>
  )
}

function MainReadingCard({ schedule, onNavigate, progressPercentage }: { schedule: DailySchedule; onNavigate: () => void; progressPercentage: number }) {
  const readingRange = schedule.startChapter === schedule.endChapter
    ? `${schedule.book} ${schedule.startChapter}장`
    : `${schedule.book} ${schedule.startChapter}-${schedule.endChapter}장`

  return (
    <ReadingCard
      onClick={onNavigate}
      className="text-[var(--color-text-primary)]"
      data-testid="main-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <CardLabel label="TODAY'S READING" />
      </div>
      <h2
        className="mb-1 font-medium leading-tight text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2, wordBreak: 'keep-all' }}
      >
        {readingRange}
      </h2>

      <div className="mb-4 text-sm text-[var(--color-text-secondary)]" style={{ fontSize: 'clamp(0.9375rem, 3.5vw, 1.125rem)' }}>
        오늘의 말씀
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="h-1 flex-1 rounded bg-[var(--color-surface-secondary)]">
          <div className="h-full rounded bg-[var(--color-accent-primary)] transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
        </div>
        <span className="min-w-[70px] text-right text-sm font-medium text-[var(--color-accent-primary)]">{progressPercentage}% 완료</span>
      </div>

      <StartButton label="통독 시작하기" />
    </ReadingCard>
  )
}

function PastIncompleteCard({ data, onNavigate }: { data: PastIncompleteData; onNavigate: () => void }) {
  return (
    <ReadingCard
      onClick={onNavigate}
      className="text-[var(--color-text-primary)]"
      data-testid="past-incomplete-card"
    >
      <CardLabel label="CATCH UP" tone="warning" />
      <h2
        className="mt-2 mb-1 font-medium leading-tight text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}
      >
        밀린 읽기가
        <br />
        <strong className="font-bold">있어요</strong>
      </h2>
      <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
        {data.date} - {data.schedule.book} {data.schedule.startChapter}-{data.schedule.endChapter}장
      </div>
      <StartButton label="밀린 읽기 하러가기" />
    </ReadingCard>
  )
}

function AllDoneCard() {
  return (
    <ReadingCard
      className="text-[var(--color-text-primary)]"
      data-testid="all-done-card"
    >
      <CardLabel label="AMAZING!" tone="success" />
      <h2
        className="mt-2 mb-1 font-medium leading-tight text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}
      >
        오늘 할 일을
        <br />
        <strong className="font-bold">모두 마쳤어요! 🎉</strong>
      </h2>
      <div className="text-sm text-[var(--color-text-secondary)]">정말 대단해요! 내일도 함께해요</div>
    </ReadingCard>
  )
}

export default function ReadingCardStack({
  isAuthenticated = true,
  todaySchedule,
  todayProgress,
  pastIncomplete,
  hasenaCompleted,
  introAvailable,
  introCompleted,
}: ReadingCardStackProps) {
  const router = useRouter()
  const cardType = determineCardType({
    isAuthenticated,
    todaySchedule,
    todayProgress,
    pastIncomplete,
    hasenaCompleted,
    introAvailable,
    introCompleted,
  })

  const handleNavigate = () => {
    router.push('/reading')
  }

  const handleLoginNavigate = () => {
    router.push('/login')
  }

  const progressPercentage = todayProgress?.isCompleted ? 100 : 0

  return (
    <div className="relative mb-6" data-testid="reading-card-stack">
      {cardType === 'login' && <LoginCard onNavigate={handleLoginNavigate} />}
      {cardType === 'main' && todaySchedule && <MainReadingCard schedule={todaySchedule} onNavigate={handleNavigate} progressPercentage={progressPercentage} />}
      {cardType === 'pastIncomplete' && pastIncomplete && <PastIncompleteCard data={pastIncomplete} onNavigate={handleNavigate} />}
      {cardType === 'hasena' && <HasenaCard />}
      {cardType === 'intro' && <IntroCard />}
      {cardType === 'allDone' && <AllDoneCard />}

      {/* Card stack shadow effect */}
      <div
        className="absolute top-2.5 right-5 left-5 -z-10 h-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] opacity-55 shadow-[var(--shadow-card)]"
        aria-hidden="true"
      />
      <div
        className="absolute top-5 right-10 left-10 -z-20 h-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] opacity-35 shadow-[var(--shadow-card)]"
        aria-hidden="true"
      />
    </div>
  )
}
