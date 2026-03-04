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
  active: 'border-[#DCFCE7] bg-[#F0FDF4] text-[#15803D]',
  recruiting: 'border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8]',
  ended: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]',
}

export default function GroupCard({ group }: GroupCardProps) {
  const planText = group.plans.length > 1
    ? `${group.plans[0]?.name ?? ''} 외 ${group.plans.length - 1}개`
    : (group.plans[0]?.name ?? '읽기 계획 없음')

  return (
    <article className="rounded-[12px] border border-[#E2E8F0] bg-[var(--color-bg-card)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`inline-flex rounded-[4px] border px-2 py-0.5 text-[0.75rem] font-medium leading-[1.2] ${statusClassName[group.status]}`}>
          {statusLabel[group.status]}
        </span>
        <span className="inline-flex items-center gap-1 text-[0.8125rem] text-[#64748B]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{group.memberCount}/{group.maxMembers}명</span>
        </span>
      </div>

      <h3 className="mb-2 text-[1.125rem] font-semibold leading-[1.4] tracking-[-0.02em] text-[#1E293B]">
        {group.name}
      </h3>

      <p className="mb-4 line-clamp-2 min-h-[2.625rem] text-[0.875rem] leading-[1.5] text-[#475569]">
        {group.description || '설명이 없습니다.'}
      </p>

      <div className="mb-4 space-y-1.5 border-t border-[#F1F5F9] pt-3 text-[0.8125rem]">
        <div className="flex items-center gap-3">
          <span className="min-w-10 text-[#94A3B8]">리더</span>
          <span className="inline-flex items-center gap-2 text-[#334155]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] text-[0.75rem] font-semibold text-[#64748B]">
              {(group.leader.nickname || '?').charAt(0)}
            </span>
            <span className="font-medium">{group.leader.nickname || '관리자'}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-10 text-[#94A3B8]">읽기표</span>
          <span className="font-medium text-[#334155]">{planText}</span>
        </div>
      </div>

      <Link
        href={`/groups/${group.id}`}
        className="inline-flex h-9 w-full items-center justify-center rounded-[6px] border border-[#E2E8F0] bg-white text-[0.8125rem] font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC]"
      >
        상세보기
      </Link>
    </article>
  )
}
