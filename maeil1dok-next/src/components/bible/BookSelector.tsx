'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { BIBLE_BOOKS, BIBLE_BOOK_ORDER } from '@/lib/bible/books'
import { searchBibleBooks } from '@/lib/bible/search'

const OT_COUNT = 39
const OT_BOOKS = BIBLE_BOOK_ORDER.slice(0, OT_COUNT)
const NT_BOOKS = BIBLE_BOOK_ORDER.slice(OT_COUNT)

interface BookSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (book: string, chapter: number, verse?: number) => void
  currentBook?: string
  currentChapter?: number
}

type Tab = 'ot' | 'nt'
type Step = 'book' | 'chapter'

export default function BookSelector({ isOpen, onClose, onSelect, currentBook, currentChapter }: BookSelectorProps) {
  const [tab, setTab] = useState<Tab>('ot')
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>('book')
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const chaptersRef = useRef<HTMLDivElement>(null)
  const booksRef = useRef<HTMLDivElement>(null)

  // Determine if selected book is Psalms (편 vs 장)
  const getChapterUnit = useCallback((bookId: string) => bookId === 'psa' ? '편' : '장', [])

  // Open/close animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true))
      })
    } else {
      setAnimating(false)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep('book')
      setSelectedBook(null)
      setQuery('')
      // Determine initial tab based on current book
      if (currentBook) {
        const idx = BIBLE_BOOK_ORDER.indexOf(currentBook as typeof BIBLE_BOOK_ORDER[number])
        setTab(idx >= OT_COUNT ? 'nt' : 'ot')
      }
    }
  }, [isOpen, currentBook])

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen && step === 'book') {
      const timer = setTimeout(() => searchRef.current?.focus(), 350)
      return () => clearTimeout(timer)
    }
  }, [isOpen, step])

  // Scroll to current chapter when entering chapter step
  useEffect(() => {
    if (step === 'chapter' && selectedBook && chaptersRef.current) {
      const timer = setTimeout(() => {
        if (!chaptersRef.current) return
        const activeBtn = chaptersRef.current.querySelector('[data-active="true"]')
        activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [step, selectedBook])

  const filteredBooks = useMemo(() => {
    if (!query.trim()) return tab === 'ot' ? OT_BOOKS : NT_BOOKS
    return searchBibleBooks(query).map((r) => r.id)
  }, [query, tab])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return searchBibleBooks(query)
  }, [query])

  function handleSelectBook(code: string) {
    setSelectedBook(code)
    setStep('chapter')
  }

  function handleSelectChapter(chapter: number) {
    if (!selectedBook) return
    onSelect(selectedBook, chapter)
    handleClose()
  }

  function handleBack() {
    setStep('book')
    setSelectedBook(null)
  }

  function handleClose() {
    onClose()
    // Delay state reset until animation completes
    setTimeout(() => {
      setStep('book')
      setSelectedBook(null)
      setQuery('')
    }, 300)
  }

  if (!visible) return null

  const bookInfo = selectedBook ? BIBLE_BOOKS[selectedBook] : null
  const isSearching = query.trim().length > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-[20px] bg-[var(--color-bg-secondary)] shadow-2xl transition-transform duration-300 ease-out ${
          animating ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="성경 선택"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[var(--color-border-default)] dark:bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {step === 'chapter' ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              onClick={handleBack}
              aria-label="뒤로"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
              </svg>
            </button>
          ) : null}
          <h3 className="text-[17px] font-bold text-[var(--color-text-primary)]">
            {step === 'book' ? '성경 선택' : `${bookInfo?.ko ?? ''} — ${getChapterUnit(selectedBook ?? '')} 선택`}
          </h3>
          <button
            type="button"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            onClick={handleClose}
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Book Selection Step */}
        {step === 'book' ? (
          <>
            {/* Search Bar */}
            <div className="px-4 pb-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-text-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="책 이름 또는 초성 (예: 창, ㅊㅅㄱ)"
                  className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-2.5 pl-10 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all duration-200 focus:border-[var(--color-accent-primary)] focus:bg-[var(--color-bg-secondary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20"
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Search Results */}
            {isSearching && searchResults.length > 0 ? (
              <div className="border-b border-[var(--color-border-light)] px-4 pb-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-primary)]">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  {searchResults.length}개를 찾았어요
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-text-secondary)] transition-all duration-150 hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent-primary)]"
                      onClick={() => handleSelectBook(result.id)}
                    >
                      <span>{result.ko}</span>
                      <span className="text-[var(--color-text-muted)]">{result.chapters}{getChapterUnit(result.id)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : isSearching && searchResults.length === 0 ? (
              <div className="border-b border-[var(--color-border-light)] px-4 pb-3">
                <p className="text-center text-sm text-[var(--color-text-muted)]">검색 결과가 없어요</p>
              </div>
            ) : null}

            {/* OT/NT Tabs (hidden during search) */}
            {!isSearching ? (
              <div className="px-4 pb-2">
                <div className="flex rounded-xl bg-[var(--color-bg-tertiary)] p-1">
                  {(['ot', 'nt'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`flex-1 rounded-[10px] py-2 text-sm font-semibold transition-all duration-200 ${
                        tab === t
                          ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                      }`}
                      onClick={() => setTab(t)}
                    >
                      {t === 'ot' ? '구약' : '신약'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Books Grid */}
            <div
              ref={booksRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe-bottom"
              style={{ maxHeight: 'calc(90vh - 220px)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {filteredBooks.map((code) => {
                  const book = BIBLE_BOOKS[code]
                  if (!book) return null
                  const isActive = currentBook === code
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`group relative flex flex-col rounded-xl border px-2.5 py-2.5 text-left transition-all duration-150 active:scale-[0.97] ${
                        isActive
                          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]'
                          : 'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)]/40 hover:bg-[var(--color-accent-light)]/50'
                      }`}
                      onClick={() => handleSelectBook(code)}
                    >
                      <span className={`text-[13px] leading-snug ${isActive ? 'font-semibold' : 'font-medium'}`}>
                        {book.ko}
                      </span>
                      <span className={`mt-0.5 text-[11px] ${isActive ? 'text-[var(--color-accent-primary)]/70' : 'text-[var(--color-text-muted)]'}`}>
                        {book.chapters}{getChapterUnit(code)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}

        {/* Chapter Selection Step */}
        {step === 'chapter' && bookInfo && selectedBook ? (
          <div
            ref={chaptersRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 pb-safe-bottom"
            style={{ maxHeight: 'calc(90vh - 140px)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* Chapter count info */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                총 {bookInfo.chapters}{getChapterUnit(selectedBook)}
              </span>
              {currentBook === selectedBook && currentChapter ? (
                <span className="inline-flex items-center rounded-md bg-[var(--color-accent-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent-primary)]">
                  현재 {currentChapter}{getChapterUnit(selectedBook)}
                </span>
              ) : null}
            </div>

            {/* Chapter Number Grid */}
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
              {Array.from({ length: bookInfo.chapters }, (_, i) => i + 1).map((ch) => {
                const isCurrent = currentBook === selectedBook && currentChapter === ch
                return (
                  <button
                    key={ch}
                    type="button"
                    data-active={isCurrent ? 'true' : undefined}
                    className={`relative flex items-center justify-center rounded-xl border py-3 text-sm font-medium transition-all duration-150 active:scale-95 ${
                      isCurrent
                        ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-white shadow-md shadow-[var(--color-accent-primary)]/25'
                        : 'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-primary)]/40 hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent-primary)]'
                    }`}
                    onClick={() => handleSelectChapter(ch)}
                  >
                    {ch}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
