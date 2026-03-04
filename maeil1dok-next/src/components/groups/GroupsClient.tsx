'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import GroupCard from '@/components/groups/GroupCard'
import type { GroupFilter, ReadingGroup } from '@/types/groups'

interface GroupsClientProps {
  groups: ReadingGroup[]
}

const FILTERS: Array<{ value: GroupFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'public', label: '공개' },
  { value: 'mine', label: '내 그룹' },
]

export default function GroupsClient({ groups }: GroupsClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('all')

  const filteredGroups = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    return groups.filter((group) => {
      const byFilter = activeFilter === 'all'
        ? true
        : activeFilter === 'public'
          ? group.isPublic
          : group.isMine

      if (!byFilter) return false
      if (!normalized) return true
      return group.name.toLowerCase().includes(normalized)
    })
  }, [activeFilter, groups, searchQuery])

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
          <h1 className="text-lg font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">그룹</h1>
        </div>
      </header>

      <section className="space-y-4 px-4 py-4">
        <div className="relative">
          <svg className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#94A3B8]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="그룹 이름으로 검색해보세요"
            className="h-12 w-full rounded-[12px] border border-[#E2E8F0] bg-white pr-4 pl-11 text-[0.9375rem] text-[#1E293B] outline-none transition-all placeholder:text-[#CBD5E1] focus:border-[#94A3B8] focus:shadow-[0_0_0_3px_rgba(148,163,184,0.1)]"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={[
                  'rounded-[20px] border px-4 py-2 text-[0.875rem] font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-[#1E293B] bg-[#1E293B] text-white'
                    : 'border-transparent bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#475569]',
                ].join(' ')}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-4 px-4 pb-6">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => <GroupCard key={group.id} group={group} />)
        ) : (
          <div className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-10 text-center">
            <p className="text-[0.9375rem] text-[#475569]">
              {searchQuery ? '검색 결과가 없습니다' : '아직 그룹이 없습니다'}
            </p>
            <p className="mt-1 text-[0.8125rem] text-[#94A3B8]">
              {searchQuery ? '다른 검색어로 시도해보세요.' : '다른 사용자들과 함께 성경을 읽어보세요!'}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
