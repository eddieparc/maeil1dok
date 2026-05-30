'use client'

import type { ScoreboardEntry } from '@/types/scoreboard'

interface LeaderboardCardProps {
  rank: number
  entry: ScoreboardEntry
}

function getInitial(name: string): string {
  return name.trim().charAt(0) || '?'
}

function IconCrown() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  )
}

export default function LeaderboardCard({ rank, entry }: LeaderboardCardProps) {
  const isTop = rank <= 3

  return (
    <li
      className={[
        'flex items-center gap-3 border-b border-[var(--color-rule)] px-4 py-3 last:border-b-0 transition-colors',
        entry.isCurrentUser
          ? 'bg-[var(--color-brand-faint)]'
          : 'bg-transparent hover:bg-[var(--color-brand-faint)]/40',
      ].join(' ')}
    >
      <div
        className={[
          'flex w-5 shrink-0 items-center justify-center text-[14px] font-semibold tabular-nums',
          isTop ? 'text-[var(--color-brand)]' : 'text-[var(--color-subtle)]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        {rank === 1 ? <IconCrown /> : rank}
      </div>

      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-warm)] text-[12px] font-semibold text-[var(--color-ink)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        <span>{getInitial(entry.nickname)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-[var(--color-ink)] -tracking-[0.01em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {entry.nickname}
          {entry.isCurrentUser ? (
            <span
              className="inline-flex items-center rounded-full bg-[var(--color-brand)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-paper)] -tracking-[0.005em]"
              style={{ fontFamily: 'var(--font-family-ui)' }}
            >
              나
            </span>
          ) : null}
        </p>
        <p
          className="mt-0.5 text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          완료 {entry.completedDays}일
        </p>
      </div>

      <div className="text-right">
        <p
          className="text-[14px] font-semibold text-[var(--color-ink)] -tracking-[0.012em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {entry.progressRate}%
        </p>
      </div>
    </li>
  )
}
