import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { Container } from '@/components/ui'
import ReadingProgressButton from './ReadingProgressButton'

function BackLink() {
  return (
    <Link
      href="/"
      className="mb-5 inline-flex items-center gap-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-mute)] -tracking-[0.005em] transition-colors hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      홈으로
    </Link>
  )
}

function PlanLink() {
  return (
    <Link
      href="/plan"
      className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-mute)] -tracking-[0.005em] transition-colors hover:text-[var(--color-ink)]"
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      통독표 보기
    </Link>
  )
}

function ReadingShellCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-6">
      {children}
    </div>
  )
}

function ReadingCaption() {
  return (
    <p
      className="text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      오늘의 통독
    </p>
  )
}

function ReadingTitle({ book, startChapter, endChapter }: { book: string; startChapter: number; endChapter: number }) {
  return (
    <h1
      className="mt-1 text-[var(--color-ink)] -tracking-[0.025em] leading-[1.25]"
      style={{
        fontFamily: 'var(--font-family-serif)',
        fontSize: 'clamp(1.5rem, 6vw, 1.875rem)',
        fontWeight: 500,
      }}
    >
      {book}{' '}
      <span className="tabular-nums">
        {startChapter === endChapter ? `${startChapter}장` : `${startChapter}-${endChapter}장`}
      </span>
    </h1>
  )
}

function ReadingDate({ date }: { date: string }) {
  return (
    <p
      className="mt-1 text-[12px] font-medium text-[var(--color-subtle)] -tracking-[0.005em] tabular-nums"
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {date}
    </p>
  )
}

export default async function ReadingPage() {
  try {
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const [schedule, subscriptions] = await Promise.all([
      repositories.schedule.getCurrentSchedule(),
      repositories.plan.getUserSubscriptions(),
    ])

    if (!schedule) {
      return (
        <Container fullHeight className="py-8">
          <div className="mx-auto max-w-md">
            <BackLink />
            <ReadingShellCard>
              <p
                className="text-center text-[14px] font-medium text-[var(--color-mute)] -tracking-[0.01em]"
                style={{ fontFamily: 'var(--font-family-ui)' }}
              >
                오늘의 통독 일정이 없습니다
              </p>
            </ReadingShellCard>
            <PlanLink />
          </div>
        </Container>
      )
    }

    const activeSubscription = subscriptions.find((subscription) => subscription.isActive) ?? null

    if (!activeSubscription) {
      return (
        <Container fullHeight className="py-8">
          <div className="mx-auto max-w-md">
            <BackLink />
            <ReadingShellCard>
              <ReadingCaption />
              <ReadingTitle book={schedule.book} startChapter={schedule.startChapter} endChapter={schedule.endChapter} />
              <ReadingDate date={schedule.date} />
              <p
                className="mt-5 rounded-2xl border border-[var(--color-brand-faint-border)] bg-[var(--color-brand-faint)] px-4 py-3 text-[13px] font-medium text-[var(--color-brand)] -tracking-[0.008em]"
                style={{ fontFamily: 'var(--font-family-ui)' }}
              >
                통독 계획을 구독해주세요
              </p>
            </ReadingShellCard>
            <PlanLink />
          </div>
        </Container>
      )
    }

    const progress = await repositories.progress.getProgress(activeSubscription.id, schedule.id)
    const initialCompleted = progress?.isCompleted ?? false

    return (
      <Container fullHeight className="py-8">
        <div className="mx-auto max-w-md">
          <BackLink />
          <ReadingShellCard>
            <ReadingCaption />
            <ReadingTitle book={schedule.book} startChapter={schedule.startChapter} endChapter={schedule.endChapter} />
            <ReadingDate date={schedule.date} />
            <div className="mt-5">
              <ReadingProgressButton
                scheduleId={schedule.id}
                subscriptionId={activeSubscription.id}
                initialCompleted={initialCompleted}
              />
            </div>
          </ReadingShellCard>
          <PlanLink />
        </div>
      </Container>
    )
  } catch {
    return (
      <Container fullHeight className="py-8">
        <div className="mx-auto max-w-md">
          <BackLink />
          <ReadingShellCard>
            <p
              className="text-center text-[14px] font-medium text-[var(--color-danger)] -tracking-[0.01em]"
              style={{ fontFamily: 'var(--font-family-ui)' }}
            >
              일정을 불러오는 중 오류가 발생했습니다
            </p>
          </ReadingShellCard>
        </div>
      </Container>
    )
  }
}
