'use client'

import type { ScoreboardEntry } from '@/types/scoreboard'

interface LeaderboardCardProps {
  rank: number
  entry: ScoreboardEntry
}

const medalMap: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

function getInitial(name: string): string {
  return name.trim().charAt(0) || '?'
}

export default function LeaderboardCard({ rank, entry }: LeaderboardCardProps) {
  const position = medalMap[rank] ?? `${rank}`

  return (
    <li
      className={[
        'flex items-center gap-3 rounded-[12px] border px-3 py-3 transition-colors',
        entry.isCurrentUser
          ? 'border-[var(--color-schedule-current-border)] bg-[var(--color-schedule-current-bg)]'
          : 'border-[var(--color-slate-200)] bg-[var(--color-bg-primary)] hover:bg-[var(--color-slate-50)]',
      ].join(' ')}
    >
      <div className="flex h-8 w-8 items-center justify-center text-[1rem] font-semibold text-[var(--color-slate-700)]">
        {position}
      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-slate-200)] bg-[var(--color-slate-100)] text-[0.875rem] font-semibold text-[var(--color-slate-600)]">
        <span>{getInitial(entry.nickname)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold text-[var(--color-slate-800)]">
          {entry.nickname}
          {entry.isCurrentUser ? <span className="ml-1 text-[0.8125rem] text-[var(--color-info)]">(나)</span> : null}
        </p>
        <p className="text-[0.8125rem] text-[var(--color-slate-500)]">
          완료 {entry.completedDays}일 · {entry.progressRate}%
        </p>
      </div>
    </li>
  )
}
