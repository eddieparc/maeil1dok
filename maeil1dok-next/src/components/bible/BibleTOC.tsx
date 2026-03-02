'use client'

import { useState, useMemo } from 'react'
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

type Tab = 'ot' | 'nt'

export default function BibleTOC({ currentBook, onSelectBook, onBack }: BibleTOCProps) {
  const [tab, setTab] = useState<Tab>('ot')
  const [query, setQuery] = useState('')

  const filteredBooks = useMemo(() => {
    if (!query.trim()) {
      return tab === 'ot' ? OT_BOOKS : NT_BOOKS
    }
    const results = searchBibleBooks(query)
    return results.map((r) => r.id)
  }, [query, tab])

  const showingAll = !query.trim()

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center gap-3">
        {onBack ? (
          <button type="button" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100" onClick={onBack} aria-label="뒤로">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
            </svg>
          </button>
        ) : null}
        <h2 className="text-xl font-bold text-gray-900">성경 목차</h2>
      </header>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="책 이름 또는 초성 검색 (예: 창, ㅊㅅㄱ)"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:bg-white"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {showingAll ? (
        <div className="flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${tab === 'ot' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('ot')}
          >
            구약 (39권)
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${tab === 'nt' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setTab('nt')}
          >
            신약 (27권)
          </button>
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
                currentBook === code
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-100 bg-white text-gray-800 hover:border-blue-200 hover:bg-blue-50'
              }`}
              onClick={() => onSelectBook(code)}
            >
              <p className="text-sm font-medium leading-snug">{book.ko}</p>
              <p className="mt-0.5 text-xs text-gray-400">{book.chapters}장</p>
            </button>
          )
        })}
      </div>

      {filteredBooks.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">검색 결과가 없어요</p>
      ) : null}
    </div>
  )
}
