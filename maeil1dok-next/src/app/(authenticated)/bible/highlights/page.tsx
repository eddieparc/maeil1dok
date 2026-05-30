'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Layers as LayersIcon, Trash2 } from 'lucide-react'
import { useModal } from '@/hooks/useModal'
import { BIBLE_BOOKS } from '@/lib/bible/books'
import { createClient } from '@/lib/supabase/client'
import { BibleSubpageLayout } from '../_shared/BibleSubpageLayout'
import { BibleSubpageTabs } from '../_shared/BibleSubpageTabs'
import { formatRelativeDate, truncate } from '../_shared/utils'
import { HighlightFilterBar, resolveHighlightColor } from './HighlightFilterBar'

interface Highlight {
  id: string
  user_id: string
  book: string
  book_name?: string
  chapter: number
  verse_start: number
  verse_end: number
  color: string
  memo?: string | null
  version: string
  created_at: string
  updated_at: string
}

function formatVerseRange(highlight: Highlight): string {
  if (highlight.verse_start === highlight.verse_end) {
    return `${highlight.chapter}:${highlight.verse_start}`
  }
  return `${highlight.chapter}:${highlight.verse_start}-${highlight.verse_end}`
}

export default function HighlightsPage() {
  const modal = useModal()

  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [bookFilter, setBookFilter] = useState('')
  const [colorFilter, setColorFilter] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadHighlights() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!isMounted) return

        if (!user) {
          setIsAuthenticated(false)
          setHighlights([])
          return
        }

        const { data, error } = await supabase
          .from('user_highlights')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!isMounted) return

        if (error) { setHighlights([]); return }
        setHighlights((data ?? []) as Highlight[])
      } catch {
        if (isMounted) setHighlights([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadHighlights()
    return () => { isMounted = false }
  }, [])

  const filteredHighlights = useMemo(() => {
    let result = highlights
    if (bookFilter) result = result.filter((h) => h.book === bookFilter)
    if (colorFilter) result = result.filter((h) => h.color === colorFilter)
    return result
  }, [bookFilter, colorFilter, highlights])

  const hasFilter = bookFilter !== '' || colorFilter !== ''
  const isEmpty = !isAuthenticated || filteredHighlights.length === 0
  const emptyText = !isAuthenticated
    ? '로그인 후 하이라이트를 확인할 수 있습니다'
    : hasFilter
      ? '해당 조건의 하이라이트가 없습니다'
      : '하이라이트가 없습니다'
  const emptyHint = isAuthenticated && !hasFilter ? '중요한 구절에 색상을 입혀보세요' : undefined
  const emptyGuide = isAuthenticated && !hasFilter
    ? ['성경 읽기 화면에서 텍스트를 드래그하세요', '나타나는 메뉴에서 "하이라이트"를 선택하세요', '원하는 색상을 선택하면 저장됩니다']
    : undefined

  async function handleDelete(highlight: Highlight) {
    const confirmed = await modal.confirm({
      title: '하이라이트 삭제',
      description: '하이라이트를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      confirmVariant: 'danger',
      icon: 'warning',
    })
    if (!confirmed) return
    const response = await fetch(`/api/bible/highlights?id=${highlight.id}`, { method: 'DELETE' })
    if (!response.ok) return
    setHighlights((prev) => prev.filter((item) => item.id !== highlight.id))
  }

  const filterBar = isAuthenticated ? (
    <HighlightFilterBar
      bookFilter={bookFilter}
      colorFilter={colorFilter}
      onBookFilterChange={setBookFilter}
      onColorFilterChange={setColorFilter}
    />
  ) : null

  const tabs = useMemo(() => <BibleSubpageTabs current="highlights" />, [])

  return (
    <BibleSubpageLayout
      title="하이라이트"
      loading={isLoading}
      loadingText="하이라이트를 불러오는 중..."
      empty={isEmpty}
      emptyText={emptyText}
      emptyHint={emptyHint}
      emptyGuide={emptyGuide}
      emptyIcon={<LayersIcon size={48} aria-hidden="true" />}
      emptyAction={
        isAuthenticated ? null : (
          <Link
            href="/login"
            className="inline-flex rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-paper)] -tracking-[0.012em] transition-colors hover:bg-[var(--color-brand-deep)]"
          >
            로그인
          </Link>
        )
      }
      tabs={tabs}
      filter={filterBar}
    >
      <ul className="m-0 list-none p-0">
        {filteredHighlights.map((highlight) => {
          const locationLabel = `${highlight.book_name || BIBLE_BOOKS[highlight.book]?.ko || highlight.book} ${formatVerseRange(highlight)}`
          const memo = highlight.memo ? truncate(highlight.memo, 100) : null

          return (
            <li
              key={highlight.id}
              className="group flex items-start gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[var(--color-bg-hover)]"
            >
              <span
                className="mt-0.5 h-[42px] w-1 shrink-0 rounded-sm"
                style={{ backgroundColor: resolveHighlightColor(highlight.color) }}
                aria-hidden="true"
              />
              <Link
                href={`/bible?book=${highlight.book}&chapter=${highlight.chapter}&verse=${highlight.verse_start}`}
                className="min-w-0 flex-1"
              >
                <p className="mb-1 text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">
                  {locationLabel}
                </p>
                {memo ? (
                  <p className="mb-1 line-clamp-2 text-[0.8125rem] text-[var(--color-text-secondary)]">{memo}</p>
                ) : null}
                <p className="text-xs text-[var(--color-text-muted)]">{formatRelativeDate(highlight.created_at)}</p>
              </Link>
              <button
                type="button"
                className="-m-1 shrink-0 rounded-md p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]"
                onClick={() => void handleDelete(highlight)}
                aria-label="하이라이트 삭제"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </BibleSubpageLayout>
  )
}
