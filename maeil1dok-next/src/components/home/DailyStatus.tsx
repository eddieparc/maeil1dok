'use client'

import type { DailyStatusData } from '@/types'
import { cn } from '@/lib/utils'

interface DailyStatusProps {
  data: DailyStatusData | null
}

interface StatCardProps {
  label: string
  value: number
  unit?: string
  icon: React.ReactNode
  accent?: 'brand' | 'ink'
}

function StatCard({ label, value, unit, icon, accent = 'ink' }: StatCardProps) {
  const valueColor =
    accent === 'brand' ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)]'
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-3.5 py-3 transition-colors',
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[var(--color-mute)]">{icon}</span>
      </div>
      <p
        className={cn(
          'leading-none -tracking-[0.025em] tabular-nums',
          valueColor,
        )}
        style={{ fontFamily: 'var(--font-family-ui)', fontSize: 22, fontWeight: 600 }}
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-[12px] font-medium text-[var(--color-subtle)]">
            {unit}
          </span>
        )}
      </p>
      <p
        className="mt-1.5 text-[11px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        {label}
      </p>
    </div>
  )
}

function IconFlame() {
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
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

function IconCalendarCheck() {
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
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  )
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

function IconCheck() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CheckItem({
  label,
  completed,
  'data-testid': testId,
}: {
  label: string
  completed: boolean
  'data-testid': string
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold -tracking-[0.005em]',
        completed
          ? 'bg-[var(--color-brand-faint)] text-[var(--color-brand)]'
          : 'border border-[var(--color-rule)] bg-transparent text-[var(--color-subtle)]',
      )}
      style={{ fontFamily: 'var(--font-family-ui)' }}
    >
      {completed ? (
        <IconCheck />
      ) : (
        <span className="block h-[7px] w-[7px] rounded-full border border-current" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  )
}

const EMPTY_STATUS: DailyStatusData = {
  currentStreak: 0,
  totalCompletedDays: 0,
  longestStreak: 0,
  readingCompleted: false,
  hasenaCompleted: false,
  introCompleted: false,
}

export function DailyStatus({ data }: DailyStatusProps) {
  const status = data ?? EMPTY_STATUS

  return (
    <div data-testid="daily-status" className="mb-3">
      <div className="mb-3 grid grid-cols-3 gap-2.5">
        <StatCard
          label="현재 연속"
          value={status.currentStreak}
          unit="일"
          icon={<IconFlame />}
          accent="brand"
        />
        <StatCard
          label="총 완료일"
          value={status.totalCompletedDays}
          unit="일"
          icon={<IconCalendarCheck />}
        />
        <StatCard
          label="최장 연속"
          value={status.longestStreak}
          unit="일"
          icon={<IconCrown />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[11px] font-medium text-[var(--color-subtle)] -tracking-[0.005em]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          오늘의 진행
        </span>
        <CheckItem data-testid="checklist-reading" label="성경읽기" completed={status.readingCompleted} />
        <CheckItem data-testid="checklist-hasena" label="하세나" completed={status.hasenaCompleted} />
        <CheckItem data-testid="checklist-intro" label="성경개론" completed={status.introCompleted} />
      </div>
    </div>
  )
}
