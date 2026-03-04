'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, FileText as DocumentIcon, Loader2, Lock } from 'lucide-react'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'

interface Note {
  id: string
  user_id?: string
  book: string
  book_name?: string | null
  chapter: number
  start_verse?: number | null
  end_verse?: number | null
  content: string
  is_private: boolean
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
          {tabs ? <div className="border-t border-[var(--color-border)] px-2 py-1">{tabs}</div> : null}
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
            {emptyHint ? <p className="mt-1 text-[0.8125rem] text-[var(--color-text-muted)]">{emptyHint}</p> : null}
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

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [bookFilter, setBookFilter] = useState('')

  useEffect(() => {
    fetch('/api/bible/notes')
      .then(async (response) => {
        if (response.status === 401) {
          setIsAuthenticated(false)
          return { data: [] }
        }

        if (!response.ok) {
          throw new Error('failed to fetch notes')
        }

        return response.json() as Promise<{ data?: Note[] }>
      })
      .then((json: { data?: Note[] }) => setNotes(json.data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setIsLoading(false))
  }, [])

  const tabs = useMemo(
    () => [
      { href: '/bible/bookmarks', label: '북마크', current: false },
      { href: '/bible/notes', label: '노트', current: true },
      { href: '/bible/highlights', label: '하이라이트', current: false },
      { href: '/bible/history', label: '기록', current: false },
    ],
    [],
  )

  const bookOptions = useMemo(
    () => ({
      old: OT_BOOK_KEYS.map((book) => ({ key: book, name: BIBLE_BOOKS[book]?.ko ?? book })),
      newer: NT_BOOK_KEYS.map((book) => ({ key: book, name: BIBLE_BOOKS[book]?.ko ?? book })),
    }),
    [],
  )

  const filteredNotes = useMemo(() => {
    if (!bookFilter) return notes
    return notes.filter((note) => note.book === bookFilter)
  }, [bookFilter, notes])

  const isEmpty = !isAuthenticated || filteredNotes.length === 0
  const hasBookFilter = bookFilter !== ''
  const emptyText = !isAuthenticated
    ? '로그인 후 묵상노트를 확인할 수 있습니다'
    : hasBookFilter
      ? '해당 책에 작성된 묵상노트가 없습니다'
      : '작성된 묵상노트가 없습니다'
  const emptyHint = isAuthenticated && !hasBookFilter ? '말씀을 읽고 묵상을 기록해보세요' : undefined
  const emptyGuide = isAuthenticated && !hasBookFilter
    ? [
      '성경 읽기 화면으로 이동하세요',
      '상단 메뉴(⋮)를 탭하세요',
      '묵상노트 버튼을 선택하세요',
    ]
    : undefined

  const filterBar = isAuthenticated ? (
    <div className="px-4 py-3">
      <select
        value={bookFilter}
        onChange={(event) => setBookFilter(event.target.value)}
        className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent-primary)]"
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
    </div>
  ) : null

  return (
    <BibleSubpageLayout
      title="묵상노트"
      loading={isLoading}
      loadingText="묵상노트를 불러오는 중..."
      empty={isEmpty}
      emptyText={emptyText}
      emptyHint={emptyHint}
      emptyGuide={emptyGuide}
      emptyIcon={<DocumentIcon size={48} aria-hidden="true" />}
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
        {filteredNotes.map((note) => {
          const locationLabel = `${note.book_name || BIBLE_BOOKS[note.book]?.ko || note.book} ${note.chapter}장`
          const preview = truncate(note.content, 120)

          return (
            <li
              key={note.id}
              className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)] transition-colors last:border-b-0 hover:bg-[var(--color-bg-hover)]"
            >
              <Link href={`/bible/notes/${note.id}`} className="block px-4 py-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[0.9375rem] font-semibold text-[var(--color-accent-primary)]">{locationLabel}</p>
                  <p className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatRelativeDate(note.updated_at)}</p>
                </div>
                <p className="line-clamp-2 text-[0.875rem] leading-relaxed text-[var(--color-text-primary)]">{preview}</p>
                <div className="mt-2 flex items-center gap-2">
                  {note.is_private ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Lock size={12} aria-hidden="true" />
                      비공개
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </BibleSubpageLayout>
  )
}
