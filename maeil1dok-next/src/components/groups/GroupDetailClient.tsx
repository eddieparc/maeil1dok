'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReadingGroup } from '@/types/groups'

interface GroupDetailClientProps {
  group: ReadingGroup | null
}

export default function GroupDetailClient({ group }: GroupDetailClientProps) {
  if (!group) {
    return (
      <main className="mx-auto min-h-[calc(100dvh-120px)] max-w-[768px] bg-[var(--color-bg-primary)] pb-24">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-card)]">
          <div className="flex h-14 items-center gap-3 px-4">
            <Link href="/groups" className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]" aria-label="뒤로 가기">
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
            <h1 className="text-lg font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">그룹 정보</h1>
          </div>
        </header>

        <div className="px-4 py-8">
          <div className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-10 text-center">
            <p className="text-[0.9375rem] text-[#475569]">그룹을 찾을 수 없습니다.</p>
            <Link href="/groups" className="mt-4 inline-flex h-9 items-center justify-center rounded-[6px] bg-[#1E293B] px-4 text-[0.8125rem] font-medium text-white">
              그룹 목록으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const planText = group.plans.length > 1
    ? `${group.plans[0]?.name ?? ''} 외 ${group.plans.length - 1}개`
    : (group.plans[0]?.name ?? '읽기 계획 없음')

  return (
    <main className="mx-auto min-h-[calc(100dvh-120px)] max-w-[768px] bg-[var(--color-bg-primary)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border-light)] bg-[var(--color-bg-card)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/groups" className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]" aria-label="뒤로 가기">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">{group.name}</h1>
        </div>
      </header>

      <section className="space-y-6 px-4 py-4">
        <article className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="h-28 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#334155]" />
          <div className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[0.75rem] font-medium text-[#64748B]">
                {group.isPublic ? '공개' : '비공개'}
              </span>
              <span className="text-[0.875rem] text-[#64748B]">{group.memberCount}/{group.maxMembers}명</span>
            </div>

            <h2 className="mb-2 text-[1.5rem] font-bold leading-[1.3] tracking-[-0.02em] text-[#1E293B]">{group.name}</h2>
            <p className="mb-5 text-[0.9375rem] leading-[1.6] text-[#475569]">{group.description || '설명이 없습니다.'}</p>

            <div className="space-y-2 border-t border-[#F1F5F9] pt-4 text-[0.875rem]">
              <div className="flex items-center gap-4">
                <span className="min-w-12 text-[#94A3B8]">리더</span>
                <span className="font-medium text-[#334155]">{group.leader.nickname}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="min-w-12 text-[#94A3B8]">읽기표</span>
                <span className="font-medium text-[#334155]">{planText}</span>
              </div>
            </div>

            <button type="button" className="mt-6 h-11 w-full rounded-[8px] bg-[#1E293B] text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#334155]">
              그룹 가입하기
            </button>
          </div>
        </article>

        <article className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[1.125rem] font-semibold text-[#1E293B]">멤버 목록</h3>
            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[0.75rem] font-medium text-[#64748B]">{group.members.length}명</span>
          </div>
          <ul className="space-y-3">
            {group.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between rounded-[8px] border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F1F5F9] text-sm font-semibold text-[#64748B]">
                    {(member.nickname || '?').charAt(0)}
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-medium text-[#1E293B]">{member.nickname}</p>
                    <p className="text-[0.75rem] text-[#94A3B8]">{new Date(member.joinedAt).toLocaleDateString('ko-KR')} 가입</p>
                  </div>
                </div>
                <span className={[
                  'rounded-[4px] border px-2 py-1 text-[0.75rem] font-medium',
                  member.role === '관리자'
                    ? 'border-[#FEF3C7] bg-[#FFFBEB] text-[#B45309]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B]',
                ].join(' ')}>
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <h3 className="mb-4 text-[1.125rem] font-semibold text-[#1E293B]">최근 활동</h3>
          <ul className="space-y-3">
            {group.activities.map((activity) => (
              <li key={activity.id} className="rounded-[8px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                <p className="text-[0.875rem] text-[#334155]">{activity.message}</p>
                <p className="mt-1 text-[0.75rem] text-[#94A3B8]">{new Date(activity.createdAt).toLocaleString('ko-KR')}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}
