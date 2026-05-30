'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'
import { searchBibleBooks } from '@/lib/bible/search'

const OT_COUNT = 39
const OT_BOOKS = BIBLE_BOOK_ORDER.slice(0, OT_COUNT)
const NT_BOOKS = BIBLE_BOOK_ORDER.slice(OT_COUNT)

interface BibleTOCProps {
  currentBook?: string
  onSelectBook: (book: string) => void
  onBack?: () => void
}

export default function BibleTOC({ currentBook, onSelectBook, onBack }: BibleTOCProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const filteredBooks = useMemo(() => searchBibleBooks(query).map((result) => result.id), [query])

  const visibleOldBooks = useMemo(() => {
    if (!query.trim()) {
      return OT_BOOKS
    }
    return filteredBooks.filter((code) => OT_BOOKS.includes(code as (typeof OT_BOOKS)[number]))
  }, [filteredBooks, query])

  const visibleNewBooks = useMemo(() => {
    if (!query.trim()) {
      return NT_BOOKS
    }
    return filteredBooks.filter((code) => NT_BOOKS.includes(code as (typeof NT_BOOKS)[number]))
  }, [filteredBooks, query])

  const hasNoResult = visibleOldBooks.length === 0 && visibleNewBooks.length === 0

  return (
    <div className="flex min-h-full flex-col bg-[var(--color-bg-primary)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-card)] px-4 py-3">
        {onBack ? <button type="button" className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]" onClick={onBack} aria-label="뒤로">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
            </svg>
          </button>
        : null}
        <h2 className="flex-1 text-lg font-semibold tracking-[-0.05em] text-[var(--color-text-primary)]">성경 목차</h2>
        <button
          type="button"
          className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
          aria-label="성경 설정"
          onClick={() => router.push('/bible/settings')}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </header>

      <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-card)] px-4 py-3">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="책 이름 또는 초성 검색 (예: 창, ㅊㅅㄱ)"
            className="w-full rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] py-[10px] pl-10 pr-4 text-[15px] tracking-[-0.05em] text-[var(--color-text-primary)] outline-none transition-[border-color,background-color,box-shadow] duration-200 focus:border-[var(--color-ink)] focus:bg-[var(--color-bg-card)] focus:ring-2 focus:ring-[var(--color-ink)]/15"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <BookSection
          title="구약"
          books={visibleOldBooks}
          currentBook={currentBook}
          onSelectBook={onSelectBook}
        />
        <BookSection
          title="신약"
          books={visibleNewBooks}
          currentBook={currentBook}
          onSelectBook={onSelectBook}
        />
      </div>

      {hasNoResult ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">검색 결과가 없어요</p>
      ) : null}
    </div>
  )
}

function BookSection({
  title,
  books,
  currentBook,
  onSelectBook,
}: {
  title: string
  books: string[]
  currentBook?: string
  onSelectBook: (book: string) => void
}) {
  if (books.length === 0) {
    return null
  }

  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-tertiary)]">{title}</h3>
      <div className="grid grid-cols-3 gap-2">
        {books.map((code) => {
          const book = BIBLE_BOOKS[code]
          if (!book) {
            return null
          }

          const chapterUnit = code === 'psa' ? '편' : '장'
          const active = currentBook === code

          return (
            <button
              key={code}
              type="button"
              className={`rounded-[10px] border px-2 py-3 text-left transition-all duration-200 ${
                active
                  ? 'border-[var(--color-ink)] bg-[var(--color-brand-faint)] text-[var(--color-brand)]'
                  : 'border-[var(--color-border-light)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:border-[var(--color-ink)] hover:bg-[var(--color-brand-faint)]'
              }`}
              onClick={() => onSelectBook(code)}
            >
              <p className="text-sm font-medium leading-snug tracking-[-0.05em]">{book.ko}</p>
              <p className={`mt-0.5 text-xs ${active ? 'text-[var(--color-brand)]/80' : 'text-[var(--color-text-tertiary)]'}`}>
                {book.chapters}
                {chapterUnit}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
