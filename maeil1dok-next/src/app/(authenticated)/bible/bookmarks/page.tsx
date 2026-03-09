'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bookmark as BookmarkIcon, Trash2 } from 'lucide-react'

import { useModal } from '@/hooks/useModal'
import { BIBLE_BOOKS } from '@/lib/bible/books'
import { BibleSubpageLayout } from '../_shared/BibleSubpageLayout'
import { BibleSubpageTabs } from '../_shared/BibleSubpageTabs'
import { formatRelativeDate } from '../_shared/utils'

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
        if (!response.ok) throw new Error('failed to fetch bookmarks')
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
  const emptyText = isAuthenticated ? '저장된 북마크가 없습니다' : '로그인 후 북마크를 확인할 수 있습니다'
  const emptyHint = isAuthenticated ? '자주 찾는 장을 저장해두세요' : undefined
  const emptyGuide = isAuthenticated
    ? ['성경 읽기 화면으로 이동하세요', '상단의 북마크 아이콘(🔖)을 탭하세요', '현재 장이 북마크에 저장됩니다']
    : undefined

  const tabs = useMemo(() => <BibleSubpageTabs current="bookmarks" />, [])

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
      tabs={tabs}
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
                <p className="mb-1 line-clamp-2 text-[0.8125rem] text-[var(--color-text-secondary)]">{bookmark.memo}</p>
              ) : null}
              <p className="text-xs text-[var(--color-text-muted)]">{formatRelativeDate(bookmark.created_at)}</p>
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
