'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import LeaderboardCard from '@/components/scoreboard/LeaderboardCard'
import type { ScoreboardData, ScoreboardPeriod } from '@/types/scoreboard'

interface ScoreboardClientProps {
  scoreboard: ScoreboardData
}

const PERIOD_OPTIONS: Array<{ value: ScoreboardPeriod; label: string }> = [
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
  { value: 'all', label: '전체' },
]

export default function ScoreboardClient({ scoreboard }: ScoreboardClientProps) {
  const [activePlanId, setActivePlanId] = useState(scoreboard.plans[0]?.id ?? 'all')
  const [activePeriod, setActivePeriod] = useState<ScoreboardPeriod>('today')

  const entries = useMemo(() => {
    const leaderboard = scoreboard.leaderboards[activePlanId]
    if (!leaderboard) return []
    return leaderboard[activePeriod]
  }, [activePeriod, activePlanId, scoreboard.leaderboards])

  return (
    <main className="mx-auto min-h-[calc(100dvh-120px)] max-w-[768px] bg-[var(--color-bg-primary)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--color-rule)] bg-[var(--color-paper-warm)]/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link
            href="/"
            className="-m-2 rounded-full p-2 text-[var(--color-mute)] transition-colors hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)]"
            aria-label="뒤로 가기"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
          <h1
            className="text-[var(--color-ink)] -tracking-[0.025em] leading-[1.2]"
            style={{
              fontFamily: 'var(--font-family-serif)',
              fontSize: 'clamp(1.25rem, 5vw, 1.5rem)',
              fontWeight: 500,
            }}
          >
            리더보드
          </h1>
        </div>
      </header>

      <section className="space-y-3 px-4 py-4">
        {/* Period toggle (Refined pill segment) */}
        <div
          className="inline-flex w-full items-center gap-0.5 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] p-1"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {PERIOD_OPTIONS.map((period) => {
            const active = activePeriod === period.value
            return (
              <button
                key={period.value}
                type="button"
                onClick={() => setActivePeriod(period.value)}
                className={[
                  'flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold -tracking-[0.005em] transition-colors',
                  active
                    ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                    : 'bg-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]',
                ].join(' ')}
              >
                {period.label}
              </button>
            )
          })}
        </div>

        {scoreboard.plans.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {scoreboard.plans.map((plan) => {
              const active = plan.id === activePlanId
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setActivePlanId(plan.id)}
                  className={[
                    'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold -tracking-[0.005em] transition-colors',
                    active
                      ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
                      : 'border-[var(--color-rule)] bg-transparent text-[var(--color-mute)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
                  ].join(' ')}
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  {plan.name}
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

      <section className="px-4 pb-6">
        {entries.length > 0 ? (
          <ol className="overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)]">
            {entries.map((entry, index) => (
              <LeaderboardCard key={entry.userId} rank={index + 1} entry={entry} />
            ))}
          </ol>
        ) : (
          <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-10 text-center">
            <p
              className="text-[14px] font-semibold text-[var(--color-ink)] -tracking-[0.01em]"
              style={{ fontFamily: 'var(--font-family-ui)' }}
            >
              리더보드 데이터가 없습니다
            </p>
            <p
              className="mt-1 text-[12px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
              style={{ fontFamily: 'var(--font-family-ui)' }}
            >
              다른 기간 또는 통독표를 선택해보세요
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
