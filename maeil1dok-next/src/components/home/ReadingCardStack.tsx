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
        'relative flex w-full flex-col justify-center overflow-hidden rounded-3xl border border-black/[0.02] p-5 shadow-[0_4px_20px_rgba(44,51,51,0.04)] transition-all duration-300',
        'dark:border-white/10 dark:shadow-none',
        isInteractive && 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(44,51,51,0.08)] active:scale-[0.98]',
        className,
      )}
      data-testid="reading-card"
      {...props}
    >
      {children}
    </div>
  )
}

function CardLabel({ label }: { label: string }) {
  return (
    <span
      className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-accent-primary)]"
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
        'mt-4 inline-flex cursor-pointer items-center gap-2 border-b border-current bg-transparent pb-1 text-base font-medium transition-opacity hover:opacity-70',
        variant === 'secondary' && 'text-sm opacity-75',
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
      className="bg-[var(--color-accent-primary)] text-white dark:bg-[var(--color-accent-primary)]"
      data-testid="login-card"
    >
      <CardLabel label="WELCOME" />
      <h2
        className="mt-2 leading-tight font-light text-white"
        style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2 }}
      >
        로그인하고
        <br />
        <strong className="font-bold">시작하세요</strong>
      </h2>
      <div className="mt-1 text-sm opacity-75">나만의 통독 기록을 관리할 수 있습니다</div>
      <StartButton label="로그인 / 회원가입" />
    </ReadingCard>
  )
}

function MainReadingCard({ schedule, onNavigate }: { schedule: DailySchedule; onNavigate: () => void }) {
  return (
    <ReadingCard
      onClick={onNavigate}
      className="bg-[var(--sanctuary-card-bg)] text-[var(--color-text-primary)] dark:bg-[var(--sanctuary-card-bg)]"
      data-testid="main-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <CardLabel label="TODAY'S READING" />
      </div>
      <h2
        className="mb-1 font-medium leading-tight text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-family-reading)', fontSize: 'clamp(1.5rem, 6vw, 2rem)', lineHeight: 1.2, wordBreak: 'keep-all' }}
      >
        {schedule.book}
        <br />
        <strong className="font-bold">
          {schedule.startChapter}-{schedule.endChapter}장
        </strong>
      </h2>
      <div className="mb-4 text-sm text-[var(--color-text-secondary)]" style={{ fontSize: 'clamp(0.9375rem, 3.5vw, 1.125rem)' }}>
        {schedule.date}
      </div>
      <StartButton label="통독 시작하기" />
    </ReadingCard>
  )
}

function PastIncompleteCard({ data, onNavigate }: { data: PastIncompleteData; onNavigate: () => void }) {
  return (
    <ReadingCard
      onClick={onNavigate}
      className="bg-gradient-to-br from-orange-50 to-orange-100 text-[var(--color-text-primary)] dark:from-orange-950 dark:to-orange-900 dark:border-orange-500/20"
      data-testid="past-incomplete-card"
    >
      <CardLabel label="CATCH UP" />
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
      className="bg-gradient-to-br from-emerald-50 to-emerald-100 text-[var(--color-text-primary)] dark:from-emerald-950 dark:to-emerald-900 dark:border-emerald-500/20"
      data-testid="all-done-card"
    >
      <CardLabel label="AMAZING!" />
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
  todaySchedule,
  todayProgress,
  pastIncomplete,
  hasenaCompleted,
  introAvailable,
  introCompleted,
}: ReadingCardStackProps) {
  const router = useRouter()
  const cardType = determineCardType({
    isAuthenticated: true,
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

  return (
    <div className="relative mb-6" data-testid="reading-card-stack">
      {cardType === 'login' && <LoginCard onNavigate={handleNavigate} />}
      {cardType === 'main' && todaySchedule && <MainReadingCard schedule={todaySchedule} onNavigate={handleNavigate} />}
      {cardType === 'pastIncomplete' && pastIncomplete && <PastIncompleteCard data={pastIncomplete} onNavigate={handleNavigate} />}
      {cardType === 'hasena' && <HasenaCard />}
      {cardType === 'intro' && <IntroCard />}
      {cardType === 'allDone' && <AllDoneCard />}

      {/* Card stack shadow effect */}
      <div
        className="absolute top-2.5 right-5 left-5 -z-10 h-full rounded-3xl bg-[var(--sanctuary-card-bg)] opacity-50 shadow-[0_4px_20px_rgba(44,51,51,0.04)] dark:bg-[var(--sanctuary-card-bg-dark)]"
        aria-hidden="true"
      />
      <div
        className="absolute top-5 right-10 left-10 -z-20 h-full rounded-3xl bg-[var(--sanctuary-card-bg)] opacity-30 shadow-[0_4px_20px_rgba(44,51,51,0.04)] dark:bg-[var(--sanctuary-card-bg-dark)]"
        aria-hidden="true"
      />
    </div>
  )
}
