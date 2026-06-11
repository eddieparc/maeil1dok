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

interface CardShellProps {
  children: ReactNode
  onClick?: () => void
  testId?: string
  variant?: 'paper' | 'faint'
  className?: string
}

function CardShell({ children, onClick, testId, variant = 'paper', className }: CardShellProps) {
  const isInteractive = typeof onClick === 'function'

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  const surfaceClass =
    variant === 'faint'
      ? 'border-[var(--color-brand-faint-border)] bg-[var(--color-brand-faint)]'
      : 'border-[var(--color-rule)] bg-[var(--color-paper)]'

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
      data-testid={testId ?? 'reading-card'}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border px-5 py-5 transition-all duration-200',
        surfaceClass,
        isInteractive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] active:scale-[0.99]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function IconArrowRight({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function IconTriangleAlert({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function IconCheckCircle({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function Badge({
  children,
  tone = 'default',
  icon,
}: {
  children: ReactNode
  tone?: 'default' | 'warning' | 'success'
  icon?: ReactNode
}) {
  const palette = {
    default: 'bg-[var(--color-brand-faint)] text-[var(--color-brand)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  }[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold -tracking-[0.005em]',
        palette,
      )}
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {icon}
      {children}
    </span>
  )
}

function PrimaryButton({
  label,
  fullWidth = true,
  variant = 'primary',
}: {
  label: string
  fullWidth?: boolean
  variant?: 'primary' | 'outline'
}) {
  const palette =
    variant === 'primary'
      ? 'bg-[var(--color-ink)] text-[var(--color-paper)] hover:bg-[var(--color-brand-deep)]'
      : 'border border-[var(--color-rule)] bg-transparent text-[var(--color-ink)] hover:border-[var(--color-ink)]'
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold -tracking-[0.012em] transition-colors',
        palette,
        fullWidth && 'w-full',
      )}
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {label}
      <IconArrowRight />
    </span>
  )
}

function CardCaption({ children, tone = 'mute' }: { children: ReactNode; tone?: 'mute' | 'brand' }) {
  const color =
    tone === 'brand' ? 'text-[var(--color-brand)]' : 'text-[var(--color-mute)]'
  return (
    <p
      className={cn('text-[11px] font-medium -tracking-[0.005em]', color)}
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {children}
    </p>
  )
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mt-1 text-[var(--color-ink)] leading-[1.25] -tracking-[0.025em]"
      style={{
        fontFamily: 'var(--font-family-serif)',
        fontSize: 'clamp(1.25rem, 5vw, 1.5rem)',
        fontWeight: 500,
      }}
    >
      {children}
    </h2>
  )
}

function CardMeta({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-1 text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]"
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {children}
    </p>
  )
}

function LoginCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <CardShell onClick={onNavigate} testId="login-card">
      <CardCaption>환영합니다</CardCaption>
      <CardTitle>
        로그인하고
        <br />
        함께 시작해요
      </CardTitle>
      <CardMeta>로그인하면 나만의 통독 기록을 관리할 수 있어요</CardMeta>
      <div className="mt-4">
        <PrimaryButton label="로그인 / 회원가입" />
      </div>
    </CardShell>
  )
}

function MainReadingCard({
  schedule,
  onNavigate,
  progressPercentage,
}: {
  schedule: DailySchedule
  onNavigate: () => void
  progressPercentage: number
}) {
  const readingRange =
    schedule.startChapter === schedule.endChapter
      ? `${schedule.book} ${schedule.startChapter}장`
      : `${schedule.book} ${schedule.startChapter}-${schedule.endChapter}장`

  return (
    <CardShell onClick={onNavigate} testId="main-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardCaption>오늘의 통독</CardCaption>
          <CardTitle>{readingRange}</CardTitle>
          <CardMeta>오늘의 말씀과 함께 걸어요</CardMeta>
        </div>
      </div>

      <div className="mt-4 mb-4">
        <div
          className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          <span>오늘 진행률</span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-rule)]">
          <div
            className="h-full rounded-full bg-[var(--color-ink)] transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <PrimaryButton label="오늘 분량 시작하기" />
    </CardShell>
  )
}

function PastIncompleteCard({
  data,
  onNavigate,
}: {
  data: PastIncompleteData
  onNavigate: () => void
}) {
  const range =
    data.schedule.startChapter === data.schedule.endChapter
      ? `${data.schedule.book} ${data.schedule.startChapter}장`
      : `${data.schedule.book} ${data.schedule.startChapter}-${data.schedule.endChapter}장`
  return (
    <CardShell onClick={onNavigate} testId="past-incomplete-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardCaption>밀린 통독</CardCaption>
          <CardTitle>{range}</CardTitle>
          <CardMeta>{data.date} 분량을 마저 읽어보세요</CardMeta>
        </div>
        <Badge tone="warning" icon={<IconTriangleAlert />}>
          밀린 통독
        </Badge>
      </div>
      <div className="mt-4">
        <PrimaryButton label="밀린 통독 시작하기" />
      </div>
    </CardShell>
  )
}

function AllDoneCard() {
  return (
    <CardShell testId="all-done-card" variant="faint">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardCaption tone="brand">오늘의 통독</CardCaption>
          <CardTitle>
            오늘 분량을
            <br />
            모두 마쳤어요
          </CardTitle>
          <CardMeta>내일도 함께 걸어요</CardMeta>
        </div>
        <Badge tone="success" icon={<IconCheckCircle />}>
          완료
        </Badge>
      </div>
    </CardShell>
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
    router.push('/bible')
  }

  const handleLoginNavigate = () => {
    router.push('/login')
  }

  const progressPercentage = todayProgress?.isCompleted ? 100 : 0

  return (
    <div className="mb-3" data-testid="reading-card-stack">
      {cardType === 'login' && <LoginCard onNavigate={handleLoginNavigate} />}
      {cardType === 'main' && todaySchedule && (
        <MainReadingCard
          schedule={todaySchedule}
          onNavigate={handleNavigate}
          progressPercentage={progressPercentage}
        />
      )}
      {cardType === 'pastIncomplete' && pastIncomplete && (
        <PastIncompleteCard data={pastIncomplete} onNavigate={handleNavigate} />
      )}
      {cardType === 'hasena' && <HasenaCard />}
      {cardType === 'intro' && <IntroCard />}
      {cardType === 'allDone' && <AllDoneCard />}
    </div>
  )
}
