'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { X, Search } from 'lucide-react'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER, type BibleVersion } from '@/lib/bible/books'
import { searchBibleBooks } from '@/lib/bible/search'
import { cn } from '@/lib/utils'

const OT_COUNT = 39
const OT_BOOKS = BIBLE_BOOK_ORDER.slice(0, OT_COUNT)
const NT_BOOKS = BIBLE_BOOK_ORDER.slice(OT_COUNT)

const VERSION_TABS: { code: BibleVersion; name: string; isNew?: boolean }[] = [
  { code: 'GAE', name: '개역개정' },
  { code: 'KNT', name: '새한글', isNew: true },
  { code: 'WOORI', name: '우리말성경', isNew: true },
  { code: 'SAENEW', name: '새번역' },
  { code: 'HAN', name: '개역한글' },
  { code: 'SAE', name: '표준새번역' },
  { code: 'COG', name: '공동번역' },
  { code: 'COGNEW', name: '공동번역개정' },
]

interface BookSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (book: string, chapter: number) => void
  onVersionSelect: (version: BibleVersion) => void
  currentBook: string
  currentChapter: number
  currentVersion: BibleVersion
}

export default function BookSelector({
  isOpen,
  onClose,
  onSelect,
  onVersionSelect,
  currentBook,
  currentChapter,
  currentVersion,
}: BookSelectorProps) {
  const [query, setQuery] = useState('')
  const [selectedBookId, setSelectedBookId] = useState(currentBook)
  const booksRef = useRef<HTMLDivElement>(null)
  const chaptersRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const getChapterUnit = useCallback((bookId: string) => (bookId === 'psa' ? '편' : '장'), [])

  const chaptersArray = useMemo(() => {
    const book = BIBLE_BOOKS[selectedBookId]
    if (!book) return []
    return Array.from({ length: book.chapters }, (_, i) => i + 1)
  }, [selectedBookId])

  const searchResultIds = useMemo(() => {
    if (!query.trim()) return null
    return new Set(searchBibleBooks(query).map((r) => r.id))
  }, [query])

  const filteredOT = useMemo(() => {
    if (!searchResultIds) return OT_BOOKS as readonly string[]
    return (OT_BOOKS as readonly string[]).filter((id) => searchResultIds.has(id))
  }, [searchResultIds])

  const filteredNT = useMemo(() => {
    if (!searchResultIds) return NT_BOOKS as readonly string[]
    return (NT_BOOKS as readonly string[]).filter((id) => searchResultIds.has(id))
  }, [searchResultIds])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setSelectedBookId(currentBook)
    const timer = setTimeout(() => {
      booksRef.current?.querySelector(`[data-id="${currentBook}"]`)?.scrollIntoView({ block: 'center' })
      chaptersRef.current?.querySelector(`[data-chapter="${currentChapter}"]`)?.scrollIntoView({ block: 'center' })
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen, currentBook, currentChapter])

  function handleSelectBook(bookId: string) {
    setSelectedBookId(bookId)
    setTimeout(() => {
      chaptersRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 0)
  }

  function handleSelectChapter(chapter: number) {
    onSelect(selectedBookId, chapter)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 flex max-h-[85vh] w-full max-w-[500px] flex-col overflow-hidden rounded-2xl bg-[var(--color-bg-card)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">성경 선택</h2>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-[var(--color-border-default)] px-0 py-3">
          <div className="flex gap-2 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {VERSION_TABS.map(({ code, name, isNew }) => (
              <button
                key={code}
                type="button"
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all',
                  code === currentVersion
                    ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white shadow-[0_2px_4px_rgba(99,102,241,0.2)]'
                    : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-tertiary)]'
                )}
                onClick={() => onVersionSelect(code)}
              >
                {name}
                {isNew ? (
                    <span
                      className={cn(
                        'rounded-[3px] px-[3.2px] py-[1px] text-[8px] font-semibold',
                        code === currentVersion ? 'bg-white/30 text-white' : 'bg-[#dc6b6b] text-white'
                      )}
                    >
                    N
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-[var(--color-border-default)] px-4 py-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              size={18}
            />
            <input
              ref={searchRef}
              type="search"
              placeholder="예: 창1:3, ㅊㅅㄱ, 요한 3:16"
              className="w-full rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] py-2.5 pl-10 pr-9 text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all focus:border-[var(--color-ink)] focus:bg-[var(--color-bg-primary)] focus:ring-2 focus:ring-[var(--color-ink)]/15"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                onClick={() => setQuery('')}
                aria-label="검색어 지우기"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-[300px] flex-1 overflow-hidden">
          <div ref={booksRef} className="flex-[7] overflow-y-auto border-r border-[var(--color-border-default)]">
            {filteredOT.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-[10px] text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
                  구약
                </div>
                {filteredOT.map((code) => (
                  <BookItem
                    key={code}
                    code={code}
                    isActive={selectedBookId === code}
                    onSelect={handleSelectBook}
                  />
                ))}
              </>
            ) : null}
            {filteredNT.length > 0 ? (
              <>
                <div className="sticky top-0 z-10 border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-[10px] text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
                  신약
                </div>
                {filteredNT.map((code) => (
                  <BookItem
                    key={code}
                    code={code}
                    isActive={selectedBookId === code}
                    onSelect={handleSelectBook}
                  />
                ))}
              </>
            ) : null}
            {filteredOT.length === 0 && filteredNT.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">검색 결과가 없어요</p>
            ) : null}
          </div>

          <div ref={chaptersRef} className="flex-[3] overflow-y-auto bg-[var(--color-bg-secondary)]">
            {chaptersArray.map((ch) => {
              const isActive = ch === currentChapter && selectedBookId === currentBook
              return (
                <button
                  key={ch}
                  type="button"
                  data-chapter={ch}
                  className={cn(
                    'flex w-full items-center justify-center border-b border-[var(--color-border-default)] py-3 text-sm transition-colors',
                    isActive
                      ? 'bg-[var(--color-ink)] font-medium text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                  )}
                  onClick={() => handleSelectChapter(ch)}
                >
                  {ch}{getChapterUnit(selectedBookId)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function BookItem({ code, isActive, onSelect }: { code: string; isActive: boolean; onSelect: (code: string) => void }) {
  const book = BIBLE_BOOKS[code]
  if (!book) return null

  return (
    <button
      type="button"
      data-id={code}
      className={cn(
        'flex w-full items-center border-b border-[var(--color-border-light)] px-4 py-3 text-left text-[15px] transition-colors',
        isActive
          ? 'bg-[var(--color-brand-faint)] font-medium text-[var(--color-brand)]'
          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
      )}
      onClick={() => onSelect(code)}
    >
      {book.ko}
    </button>
  )
}
