'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { UserProgress } from '@/types/progress'
import type { DailySchedule } from '@/types/schedule'
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

function Card({ children, onClick, className = '', ...props }: CardProps) {
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
      className={`relative w-full overflow-hidden rounded-3xl border border-white/20 p-5 shadow-[0_12px_26px_rgba(0,0,0,0.14)] transition-all duration-200 ${
        isInteractive ? 'cursor-pointer active:scale-[0.98] hover:shadow-[0_16px_32px_rgba(0,0,0,0.2)]' : ''
      } ${className}`}
      data-testid="reading-card"
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_58%)]" />
      <div className="relative">{children}</div>
    </div>
  )
}

function CardLabel({ label }: { label: string }) {
  return <span className="text-xs font-semibold tracking-[0.18em] text-current/65 uppercase">{label}</span>
}

function StartButton({ label }: { label: string }) {
  return (
    <div className="mt-4 inline-flex items-center gap-1 rounded-xl bg-white/25 px-4 py-2 text-sm font-semibold text-current backdrop-blur-sm">
      <span>{label}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </div>
  )
}

function LoginCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Card onClick={onNavigate} className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white" data-testid="login-card">
      <CardLabel label="WELCOME" />
      <h2 className="mt-2 text-2xl leading-tight font-light">
        로그인하고
        <br />
        <strong className="font-bold">시작하세요</strong>
      </h2>
      <p className="mt-1 text-sm opacity-75">나만의 통독 기록을 관리할 수 있습니다</p>
      <StartButton label="로그인 / 회원가입" />
    </Card>
  )
}

function MainReadingCard({ schedule, onNavigate }: { schedule: DailySchedule; onNavigate: () => void }) {
  return (
    <Card onClick={onNavigate} className="bg-gradient-to-br from-sky-600 to-indigo-900 text-white" data-testid="main-card">
      <CardLabel label="TODAY'S READING" />
      <h2 className="mt-2 text-2xl leading-tight font-light">
        {schedule.book}
        <br />
        <strong className="font-bold">
          {schedule.startChapter}-{schedule.endChapter}장
        </strong>
      </h2>
      <p className="mt-1 text-sm opacity-75">{schedule.date}</p>
      <StartButton label="통독 시작하기" />
    </Card>
  )
}

function PastIncompleteCard({ data, onNavigate }: { data: PastIncompleteData; onNavigate: () => void }) {
  return (
    <Card
      onClick={onNavigate}
      className="bg-gradient-to-br from-amber-500 to-orange-700 text-white"
      data-testid="past-incomplete-card"
    >
      <CardLabel label="CATCH UP" />
      <h2 className="mt-2 text-2xl leading-tight font-light">
        밀린 읽기가
        <br />
        <strong className="font-bold">있어요</strong>
      </h2>
      <p className="mt-1 text-sm opacity-75">
        {data.date} - {data.schedule.book} {data.schedule.startChapter}-{data.schedule.endChapter}장
      </p>
      <StartButton label="밀린 읽기 하러가기" />
    </Card>
  )
}

function AllDoneCard() {
  return (
    <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white" data-testid="all-done-card">
      <CardLabel label="AMAZING!" />
      <h2 className="mt-2 text-2xl leading-tight font-light">
        오늘 할 일을
        <br />
        <strong className="font-bold">모두 마쳤어요! 🎉</strong>
      </h2>
      <p className="mt-1 text-sm opacity-75">정말 대단해요! 내일도 함께해요</p>
    </Card>
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
    <div className="px-4 py-2" data-testid="reading-card-stack">
      {cardType === 'login' && <LoginCard onNavigate={handleNavigate} />}
      {cardType === 'main' && todaySchedule && <MainReadingCard schedule={todaySchedule} onNavigate={handleNavigate} />}
      {cardType === 'pastIncomplete' && pastIncomplete && <PastIncompleteCard data={pastIncomplete} onNavigate={handleNavigate} />}
      {cardType === 'hasena' && <HasenaCard />}
      {cardType === 'intro' && <IntroCard />}
      {cardType === 'allDone' && <AllDoneCard />}
    </div>
  )
}
