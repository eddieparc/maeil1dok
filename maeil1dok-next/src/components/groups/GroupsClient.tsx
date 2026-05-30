'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import GroupCard from '@/components/groups/GroupCard'
import Container from '@/components/ui/Container'
import EmptyState from '@/components/ui/EmptyState'
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
    <main className="min-h-[calc(100dvh-120px)] bg-[var(--color-bg-primary)] pb-24">
      <Container maxWidth="content" className="px-0">
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
              그룹
            </h1>
          </div>
        </header>

        <section className="space-y-3 px-4 py-4">
          <div className="relative">
            <svg className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="그룹 이름으로 검색해보세요"
              className="h-12 w-full rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] pr-4 pl-11 text-[14px] font-medium text-[var(--color-ink)] -tracking-[0.01em] outline-none transition-colors placeholder:font-medium placeholder:text-[var(--color-subtle)] focus:border-[var(--color-ink)]"
              style={{ fontFamily: 'var(--font-family-ui)' }}
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
                    'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold -tracking-[0.005em] transition-colors',
                    active
                      ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
                      : 'border-[var(--color-rule)] bg-transparent text-[var(--color-mute)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]',
                  ].join(' ')}
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-3 px-4 pb-6">
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => <GroupCard key={group.id} group={group} />)
          ) : (
            <EmptyState
              title={searchQuery ? '검색 결과가 없습니다' : '아직 그룹이 없습니다'}
              description={searchQuery ? '다른 검색어로 시도해보세요' : '다른 사용자들과 함께 성경을 읽어보세요'}
              className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-10"
            />
          )}
        </section>
      </Container>
    </main>
  )
}
