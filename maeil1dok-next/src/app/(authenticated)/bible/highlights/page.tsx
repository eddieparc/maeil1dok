'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Layers as LayersIcon, Loader2, Trash2 } from 'lucide-react'
import { useModal } from '@/hooks/useModal'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'
import { createClient } from '@/lib/supabase/client'

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

interface BibleSubpageLayoutProps {
  title: string
  loading?: boolean
  loadingText?: string
  empty?: boolean
  emptyText?: string
  emptyHint?: string
  emptyGuide?: string[]
  actions?: ReactNode
  tabs?: ReactNode
  filter?: ReactNode
  emptyIcon?: ReactNode
  emptyAction?: ReactNode
  children: ReactNode
}

const OT_BOOK_KEYS = BIBLE_BOOK_ORDER.slice(0, 39)
const NT_BOOK_KEYS = BIBLE_BOOK_ORDER.slice(39)

const HIGHLIGHT_COLOR_OPTIONS = [
  { value: 'yellow', name: '노랑', hex: '#FACC15' },
  { value: 'green', name: '초록', hex: '#4ADE80' },
  { value: 'blue', name: '파랑', hex: '#60A5FA' },
  { value: 'pink', name: '분홍', hex: '#F472B6' },
  { value: 'purple', name: '보라', hex: '#C084FC' },
] as const

function resolveHighlightColor(value: string): string {
  if (!value) return '#FACC15'
  if (value.startsWith('#')) return value

  const found = HIGHLIGHT_COLOR_OPTIONS.find((option) => option.value === value)
  return found ? found.hex : value
}

function formatRelativeDate(value: string): string {
  const now = Date.now()
  const target = new Date(value).getTime()

  if (Number.isNaN(target)) {
    return value
  }

  const diffSeconds = Math.floor((now - target) / 1000)
  if (diffSeconds < 60) return '방금 전'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}분 전`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}시간 전`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}일 전`

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 5) return `${diffWeeks}주 전`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}개월 전`

  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatVerseRange(highlight: Highlight): string {
  if (highlight.verse_start === highlight.verse_end) {
    return `${highlight.chapter}:${highlight.verse_start}`
  }

  return `${highlight.chapter}:${highlight.verse_start}-${highlight.verse_end}`
}

function truncateMemo(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

function BibleSubpageLayout({
  title,
  loading = false,
  loadingText = '불러오는 중...',
  empty = false,
  emptyText = '데이터가 없습니다',
  emptyHint,
  emptyGuide,
  actions,
  tabs,
  filter,
  emptyIcon,
  emptyAction,
  children,
}: BibleSubpageLayoutProps) {
  const router = useRouter()

  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)] pb-24">
      <div className="mx-auto min-h-dvh max-w-[768px] bg-[var(--color-bg-primary)]">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              onClick={() => router.back()}
              aria-label="뒤로 가기"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="flex-1 text-lg font-semibold text-[var(--color-text-primary)]">{title}</h1>
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          </div>
          {tabs ? (
            <div className="border-t border-[var(--color-border)] px-2 py-1">{tabs}</div>
          ) : null}
          {filter ? (
            <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-card)]">{filter}</div>
          ) : null}
        </header>

        {loading ? (
          <section className="flex min-h-[calc(100dvh-140px)] flex-col items-center justify-center gap-3 px-6 text-center text-[var(--color-text-secondary)]">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p className="text-sm">{loadingText}</p>
          </section>
        ) : empty ? (
          <section className="flex min-h-[calc(100dvh-140px)] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 text-[var(--color-text-muted)]">{emptyIcon}</div>
            <p className="text-[0.9375rem] text-[var(--color-text-secondary)]">{emptyText}</p>
            {emptyHint ? (
              <p className="mt-1 text-[0.8125rem] text-[var(--color-text-muted)]">{emptyHint}</p>
            ) : null}
            {emptyGuide && emptyGuide.length > 0 ? (
              <ol className="mt-4 w-full max-w-[360px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-left text-[0.8125rem] text-[var(--color-text-secondary)]">
                {emptyGuide.map((step) => (
                  <li key={step} className="mb-2 last:mb-0">{step}</li>
                ))}
              </ol>
            ) : null}
            {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
          </section>
        ) : (
          <section>{children}</section>
        )}
      </div>
    </main>
  )
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
        const {
          data: { user },
        } = await supabase.auth.getUser()

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

        if (error) {
          setHighlights([])
          return
        }

        setHighlights((data ?? []) as Highlight[])
      } catch {
        if (isMounted) {
          setHighlights([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadHighlights()

    return () => {
      isMounted = false
    }
  }, [])

  const tabs = useMemo(
    () => [
      { href: '/bible/bookmarks', label: '북마크', current: false },
      { href: '/bible/notes', label: '노트', current: false },
      { href: '/bible/highlights', label: '하이라이트', current: true },
      { href: '/bible/history', label: '기록', current: false },
    ],
    [],
  )

  const filteredHighlights = useMemo(() => {
    let result = highlights

    if (bookFilter) {
      result = result.filter((highlight) => highlight.book === bookFilter)
    }

    if (colorFilter) {
      result = result.filter((highlight) => highlight.color === colorFilter)
    }

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
    ? [
      '성경 읽기 화면에서 텍스트를 드래그하세요',
      '나타나는 메뉴에서 "하이라이트"를 선택하세요',
      '원하는 색상을 선택하면 저장됩니다',
    ]
    : undefined

  const bookOptions = useMemo(
    () => ({
      old: OT_BOOK_KEYS.map((book) => ({ key: book, name: BIBLE_BOOKS[book]?.ko ?? book })),
      newer: NT_BOOK_KEYS.map((book) => ({ key: book, name: BIBLE_BOOKS[book]?.ko ?? book })),
    }),
    [],
  )

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

    const response = await fetch(`/api/bible/highlights?id=${highlight.id}`, {
      method: 'DELETE',
    })

    if (!response.ok) return

    setHighlights((prev) => prev.filter((item) => item.id !== highlight.id))
  }

  const filterBar = isAuthenticated ? (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2">
        <select
          value={bookFilter}
          onChange={(event) => setBookFilter(event.target.value)}
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent-primary)]"
          aria-label="성경 권 필터"
        >
          <option value="">전체</option>
          <optgroup label="구약">
            {bookOptions.old.map((book) => (
              <option key={book.key} value={book.key}>{book.name}</option>
            ))}
          </optgroup>
          <optgroup label="신약">
            {bookOptions.newer.map((book) => (
              <option key={book.key} value={book.key}>{book.name}</option>
            ))}
          </optgroup>
        </select>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setColorFilter('')}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              colorFilter === ''
                ? 'border-[var(--color-text-primary)] bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
            ].join(' ')}
          >
            모든 색상
          </button>
          {HIGHLIGHT_COLOR_OPTIONS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setColorFilter(color.value)}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                colorFilter === color.value
                  ? 'border-[var(--color-text-primary)] bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]',
              ].join(' ')}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color.hex }}
                aria-hidden="true"
              />
              <span>{color.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

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
            className="inline-flex rounded-lg bg-[var(--color-accent-primary)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            로그인
          </Link>
        )
      }
      tabs={(
        <nav className="flex items-center gap-1 overflow-x-auto px-2" aria-label="성경 활동 네비게이션">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab.current
                  ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
              aria-current={tab.current ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
      filter={filterBar}
    >
      <ul className="m-0 list-none p-0">
        {filteredHighlights.map((highlight) => {
          const locationLabel = `${highlight.book_name || BIBLE_BOOKS[highlight.book]?.ko || highlight.book} ${formatVerseRange(highlight)}`
          const memo = highlight.memo ? truncateMemo(highlight.memo, 100) : null

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
                className="-m-1 shrink-0 rounded-md p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-red-500"
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
