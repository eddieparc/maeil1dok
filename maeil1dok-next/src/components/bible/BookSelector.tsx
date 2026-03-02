'use client'

import { useState, useMemo } from 'react'
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

  const filteredBooks = useMemo(() => {
    if (!query.trim()) return tab === 'ot' ? OT_BOOKS : NT_BOOKS
    return searchBibleBooks(query).map((r) => r.id)
  }, [query, tab])

  function handleSelectBook(code: string) {
    setSelectedBook(code)
    setStep('chapter')
  }

  function handleSelectChapter(chapter: number) {
    if (!selectedBook) return
    onSelect(selectedBook, chapter)
    onClose()
    setStep('book')
    setSelectedBook(null)
    setQuery('')
  }

  function handleBack() {
    setStep('book')
    setSelectedBook(null)
  }

  if (!isOpen) return null

  const bookInfo = selectedBook ? BIBLE_BOOKS[selectedBook] : null

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white">
        <div className="sticky top-0 bg-white px-4 pb-2 pt-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
          <div className="flex items-center gap-2">
            {step === 'chapter' ? (
              <button type="button" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={handleBack} aria-label="뒤로">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
                </svg>
              </button>
            ) : null}
            <h3 className="text-lg font-bold text-gray-900">
              {step === 'book' ? '책 선택' : `${bookInfo?.ko ?? ''} — 장 선택`}
            </h3>
            <button type="button" className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="닫기">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 pb-8">
          {step === 'book' ? (
            <>
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  placeholder="책 이름 또는 초성 (예: 창, ㅊㅅㄱ)"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {!query.trim() ? (
                <div className="mb-3 flex rounded-xl bg-gray-100 p-1">
                  {(['ot', 'nt'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                      onClick={() => setTab(t)}
                    >
                      {t === 'ot' ? '구약' : '신약'}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {filteredBooks.map((code) => {
                  const book = BIBLE_BOOKS[code]
                  if (!book) return null
                  return (
                    <button
                      key={code}
                      type="button"
                      className={`rounded-xl border px-2 py-3 text-left transition ${
                        currentBook === code ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-800 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                      onClick={() => handleSelectBook(code)}
                    >
                      <p className="text-sm font-medium leading-snug">{book.ko}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{book.chapters}장</p>
                    </button>
                  )
                })}
              </div>
            </>
          ) : bookInfo && selectedBook ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: bookInfo.chapters }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`rounded-xl border py-3 text-sm font-medium transition ${
                    currentBook === selectedBook && currentChapter === ch
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-gray-100 bg-white text-gray-800 hover:border-blue-200 hover:bg-blue-50'
                  }`}
                  onClick={() => handleSelectChapter(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
