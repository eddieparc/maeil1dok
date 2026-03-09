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
  active: 'border-[var(--color-success-bg)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  recruiting: 'border-[var(--color-info-bg)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  ended: 'border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]',
}

export default function GroupCard({ group }: GroupCardProps) {
  const planText = group.plans.length > 1
    ? `${group.plans[0]?.name ?? ''} 외 ${group.plans.length - 1}개`
    : (group.plans[0]?.name ?? '읽기 계획 없음')

  return (
    <article className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[var(--shadow-card-hover)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[0.75rem] font-medium leading-[1.2] ${statusClassName[group.status]}`}>
          {statusLabel[group.status]}
        </span>
        <span className="inline-flex items-center gap-1 text-[0.8125rem] text-[var(--color-text-tertiary)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{group.memberCount}/{group.maxMembers}명</span>
        </span>
      </div>

      <h3 className="mb-2 text-lg font-semibold leading-[1.4] tracking-[-0.02em] text-[var(--color-text-primary)]">
        {group.name}
      </h3>

      <p className="mb-4 line-clamp-2 min-h-[2.625rem] text-[0.875rem] leading-[1.5] text-[var(--color-text-secondary)]">
        {group.description || '설명이 없습니다.'}
      </p>

      <div className="mb-4 space-y-1.5 border-t border-[var(--color-surface-secondary)] pt-3 text-[0.8125rem]">
        <div className="flex items-center gap-3">
          <span className="min-w-10 text-[var(--color-text-tertiary)]">리더</span>
          <span className="inline-flex items-center gap-2 text-[var(--color-text-primary)]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] text-[0.75rem] font-semibold text-[var(--color-text-tertiary)]">
              {(group.leader.nickname || '?').charAt(0)}
            </span>
            <span className="font-medium">{group.leader.nickname || '관리자'}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-10 text-[var(--color-text-tertiary)]">읽기표</span>
          <span className="font-medium text-[var(--color-text-primary)]">{planText}</span>
        </div>
      </div>

      <Link
        href={`/groups/${group.id}`}
        className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] text-[0.8125rem] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
      >
        상세보기
      </Link>
    </article>
  )
}
