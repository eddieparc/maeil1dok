'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileText as DocumentIcon, Lock } from 'lucide-react'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'
import { BibleSubpageLayout } from '../_shared/BibleSubpageLayout'
import { BibleSubpageTabs } from '../_shared/BibleSubpageTabs'
import { formatRelativeDate, truncate } from '../_shared/utils'

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

const OT_BOOK_KEYS = BIBLE_BOOK_ORDER.slice(0, 39)
const NT_BOOK_KEYS = BIBLE_BOOK_ORDER.slice(39)

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
        if (!response.ok) throw new Error('failed to fetch notes')
        return response.json() as Promise<{ data?: Note[] }>
      })
      .then((json: { data?: Note[] }) => setNotes(json.data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setIsLoading(false))
  }, [])

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
    ? ['성경 읽기 화면으로 이동하세요', '상단 메뉴(⋮)를 탭하세요', '묵상노트 버튼을 선택하세요']
    : undefined

  const filterBar = isAuthenticated ? (
    <div className="px-4 py-3">
      <select
        value={bookFilter}
        onChange={(event) => setBookFilter(event.target.value)}
        className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-ink)]"
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

  const tabs = useMemo(() => <BibleSubpageTabs current="notes" />, [])

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
                  <p className="text-[0.9375rem] font-semibold text-[var(--color-brand)]">{locationLabel}</p>
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
