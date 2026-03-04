'use client'

import { useEffect, type ReactNode, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bookmark as BookmarkIcon, ChevronLeft, Loader2, Trash2 } from 'lucide-react'

import { useModal } from '@/hooks/useModal'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface Bookmark {
  id: string
  bookmark_type: 'chapter' | 'verse'
  book: string
  book_name?: string
  chapter: number
  start_verse?: number | null
  end_verse?: number | null
  title?: string | null
  memo?: string | null
  color?: string | null
  created_at: string
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
  emptyIcon?: ReactNode
  emptyAction?: ReactNode
  children: ReactNode
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
  emptyIcon,
  emptyAction,
  children,
}: BibleSubpageLayoutProps) {
  const router = useRouter()

  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)] pb-24">
      <div className="mx-auto min-h-dvh max-w-[768px] bg-[var(--color-bg-primary)]">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border,var(--color-border-default))] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              onClick={() => router.back()}
              aria-label="뒤로 가기"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="flex-1 text-lg font-semibold text-[var(--color-text-primary)]">
              {title}
            </h1>
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          </div>
          {tabs ? (
            <div className="border-t border-[var(--color-border,var(--color-border-default))] px-2 py-1">
              {tabs}
            </div>
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
              <ol className="mt-4 w-full max-w-[360px] rounded-xl border border-[var(--color-border,var(--color-border-default))] bg-[var(--color-bg-card)] p-4 text-left text-[0.8125rem] text-[var(--color-text-secondary)]">
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

function formatLocation(bookmark: Bookmark): string {
  if (bookmark.bookmark_type === 'verse' && bookmark.start_verse) {
    if (bookmark.end_verse && bookmark.start_verse !== bookmark.end_verse) {
      return `${bookmark.chapter}:${bookmark.start_verse}-${bookmark.end_verse}`
    }

    return `${bookmark.chapter}:${bookmark.start_verse}`
  }

  return `${bookmark.chapter}장`
}

export default function BookmarksPage() {
  const modal = useModal()

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  useEffect(() => {
    fetch('/api/bible/bookmarks')
      .then(async (response) => {
        if (response.status === 401) {
          setIsAuthenticated(false)
          return { data: [] }
        }

        if (!response.ok) {
          throw new Error('failed to fetch bookmarks')
        }

        return response.json() as Promise<{ data?: Bookmark[] }>
      })
      .then((json: { data?: Bookmark[] }) => setBookmarks(json.data ?? []))
      .catch(() => setBookmarks([]))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleDelete(id: string) {
    const confirmed = await modal.confirm({
      title: '북마크 삭제',
      description: '이 북마크를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      confirmVariant: 'danger',
      icon: 'warning',
    })

    if (!confirmed) return

    const response = await fetch(`/api/bible/bookmarks?id=${id}`, { method: 'DELETE' })
    if (!response.ok) return

    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }

  const isEmpty = !isAuthenticated || bookmarks.length === 0
  const emptyText = isAuthenticated
    ? '저장된 북마크가 없습니다'
    : '로그인 후 북마크를 확인할 수 있습니다'
  const emptyHint = isAuthenticated ? '자주 찾는 장을 저장해두세요' : undefined
  const emptyGuide = isAuthenticated
    ? [
      '성경 읽기 화면으로 이동하세요',
      '상단의 북마크 아이콘(🔖)을 탭하세요',
      '현재 장이 북마크에 저장됩니다',
    ]
    : undefined

  const tabs = useMemo(
    () => [
      { href: '/bible/bookmarks', label: '북마크', current: true },
      { href: '/bible/notes', label: '노트', current: false },
      { href: '/bible/highlights', label: '하이라이트', current: false },
      { href: '/bible/history', label: '기록', current: false },
    ],
    [],
  )

  return (
    <BibleSubpageLayout
      title="북마크"
      loading={isLoading}
      loadingText="북마크를 불러오는 중..."
      empty={isEmpty}
      emptyText={emptyText}
      emptyHint={emptyHint}
      emptyGuide={emptyGuide}
      emptyIcon={<BookmarkIcon size={48} aria-hidden="true" />}
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
    >
      <ul className="m-0 list-none p-0">
        {bookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="group flex items-start gap-3 border-b border-[var(--color-border,var(--color-border-default))] bg-[var(--color-bg-card)] px-4 py-4 transition-colors last:border-b-0 hover:bg-[var(--color-bg-hover)]"
          >
            <span
              className="mt-0.5 h-[42px] w-1 shrink-0 rounded-sm"
              style={{ backgroundColor: bookmark.color || '#3B82F6' }}
              aria-hidden="true"
            />
            <Link
              href={`/bible?book=${bookmark.book}&chapter=${bookmark.chapter}${bookmark.bookmark_type === 'verse' && bookmark.start_verse ? `&verse=${bookmark.start_verse}` : ''}`}
              className="min-w-0 flex-1"
            >
              <p className="mb-1 text-[0.9375rem] font-semibold text-[var(--color-text-primary)]">
                {bookmark.book_name || BIBLE_BOOKS[bookmark.book]?.ko || bookmark.book} {formatLocation(bookmark)}
              </p>
              {bookmark.title ? (
                <p className="mb-1 text-[0.875rem] text-[var(--color-text-primary)]">{bookmark.title}</p>
              ) : null}
              {bookmark.memo ? (
                <p className="mb-1 line-clamp-2 text-[0.8125rem] text-[var(--color-text-secondary)]">
                  {bookmark.memo}
                </p>
              ) : null}
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatRelativeDate(bookmark.created_at)}
              </p>
            </Link>
            <button
              type="button"
              className="-m-1 shrink-0 rounded-md p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-red-500"
              onClick={() => void handleDelete(bookmark.id)}
              aria-label="북마크 삭제"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </BibleSubpageLayout>
  )
}
