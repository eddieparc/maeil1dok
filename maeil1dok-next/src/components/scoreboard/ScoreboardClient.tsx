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
  { value: 'week', label: '이번주' },
  { value: 'month', label: '이번달' },
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
      <header className="sticky top-0 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-card)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link
            href="/"
            className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            aria-label="뒤로 가기"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="text-lg font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">스코어보드</h1>
        </div>
      </header>

      <section className="space-y-4 px-4 py-4">
        <div className="rounded-[12px] border border-[var(--color-slate-200)] bg-white p-3">
          <p className="mb-2 text-[0.75rem] font-medium text-[var(--color-slate-500)]">기간</p>
          <div className="grid grid-cols-4 gap-2">
            {PERIOD_OPTIONS.map((period) => {
              const active = activePeriod === period.value
              return (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => setActivePeriod(period.value)}
                  className={[
                    'h-9 rounded-[10px] border text-[0.8125rem] font-medium transition-colors',
                    active
                      ? 'border-[#1E293B] bg-[#1E293B] text-white'
                      : 'border-[var(--color-slate-200)] bg-white text-[var(--color-slate-600)] hover:bg-[var(--color-slate-50)]',
                  ].join(' ')}
                >
                  {period.label}
                </button>
              )
            })}
          </div>
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
                    'rounded-[20px] border px-4 py-2 text-[0.875rem] font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'border-[#1E293B] bg-[#1E293B] text-white'
                      : 'border-transparent bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#475569]',
                  ].join(' ')}
                >
                  {plan.name}
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

      <section className="px-4 pb-6">
        <div className="rounded-[12px] border border-[var(--color-slate-200)] bg-white p-3 shadow-[var(--shadow-sm)]">
          {entries.length > 0 ? (
            <ol className="space-y-2">
              {entries.map((entry, index) => (
                <LeaderboardCard key={entry.userId} rank={index + 1} entry={entry} />
              ))}
            </ol>
          ) : (
            <div className="rounded-[10px] border border-[var(--color-slate-200)] bg-[var(--color-slate-50)] px-5 py-10 text-center">
              <p className="text-[0.9375rem] text-[var(--color-slate-700)]">리더보드 데이터가 없습니다</p>
              <p className="mt-1 text-[0.8125rem] text-[var(--color-slate-500)]">다른 기간 또는 읽기표를 선택해보세요.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
