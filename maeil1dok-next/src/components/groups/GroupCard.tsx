'use client'

import Link from 'next/link'
import type { ReadingGroup } from '@/types/groups'

interface GroupCardProps {
  group: ReadingGroup
}

const statusLabel: Record<ReadingGroup['status'], string> = {
  active: '활동중',
  recruiting: '모집중',
  ended: '종료',
}

const statusClassName: Record<ReadingGroup['status'], string> = {
  active: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  recruiting: 'bg-[var(--color-brand-faint)] text-[var(--color-brand)]',
  ended: 'bg-[var(--color-rule)] text-[var(--color-mute)]',
}

export default function GroupCard({ group }: GroupCardProps) {
  const planText =
    group.plans.length > 1
      ? `${group.plans[0]?.name ?? ''} 외 ${group.plans.length - 1}개`
      : group.plans[0]?.name ?? '읽기 계획 없음'

  return (
    <article className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] p-5 transition-colors hover:border-[var(--color-ink)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold -tracking-[0.005em] ${statusClassName[group.status]}`}
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          {statusLabel[group.status]}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-subtle)] -tracking-[0.005em] tabular-nums"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{group.memberCount}/{group.maxMembers}명</span>
        </span>
      </div>

      <h3
        className="mb-2 text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
        style={{
          fontFamily: 'var(--font-family-serif)',
          fontSize: '1.125rem',
          fontWeight: 500,
        }}
      >
        {group.name}
      </h3>

      <p
        className="mb-4 line-clamp-2 min-h-[2.625rem] text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]"
        style={{ fontFamily: 'var(--font-family-ui)', lineHeight: 1.55 }}
      >
        {group.description || '설명이 없습니다'}
      </p>

      <div
        className="mb-4 space-y-1.5 border-t border-[var(--color-rule)] pt-3 text-[12px] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        <div className="flex items-center gap-3">
          <span className="min-w-10 font-medium text-[var(--color-subtle)]">리더</span>
          <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-rule)] bg-[var(--color-paper-warm)] text-[11px] font-semibold text-[var(--color-ink)]">
              {(group.leader.nickname || '?').charAt(0)}
            </span>
            <span className="font-semibold">{group.leader.nickname || '관리자'}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-10 font-medium text-[var(--color-subtle)]">읽기표</span>
          <span className="font-semibold text-[var(--color-ink)]">{planText}</span>
        </div>
      </div>

      <Link
        href={`/groups/${group.id}`}
        className="inline-flex h-9 w-full items-center justify-center rounded-full border border-[var(--color-rule)] bg-transparent text-[12px] font-semibold text-[var(--color-ink)] -tracking-[0.005em] transition-colors hover:border-[var(--color-ink)] hover:bg-[var(--color-brand-faint)]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
      >
        상세보기
      </Link>
    </article>
  )
}
