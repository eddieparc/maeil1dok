'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface Highlight {
  id: string
  book: string
  chapter: number
  verse: number
  color: string
  memo?: string
  created_at: string
}

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [colorFilter, setColorFilter] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/bible/highlights')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { data?: Highlight[] }) => setHighlights(json.data ?? []))
      .catch(() => setHighlights([]))
      .finally(() => setIsLoading(false))
  }, [])

  const colors = useMemo(() => [...new Set(highlights.map((h) => h.color))], [highlights])

  const filtered = colorFilter
    ? highlights.filter((h) => h.color === colorFilter)
    : highlights

  // Group by book
  const grouped = filtered.reduce<Record<string, Highlight[]>>((acc, h) => {
    if (!acc[h.book]) acc[h.book] = []
    acc[h.book].push(h)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
          <Link href="/bible" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">하이라이트</h1>
        </header>

        <div className="px-4 pt-4">
          {/* Color filter */}
          {colors.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${colorFilter === null ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setColorFilter(null)}
              >
                전체
              </button>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${colorFilter === c ? 'border-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}
                  onClick={() => setColorFilter(c === colorFilter ? null : c)}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} />
                </button>
              ))}
            </div>
          ) : null}

          {isLoading ? (
            <p className="py-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">하이라이트가 없어요</p>
          ) : (
            Object.entries(grouped).map(([book, items]) => (
              <section key={book} className="mb-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-500">{BIBLE_BOOKS[book]?.ko ?? book}</h2>
                <div className="flex flex-col gap-1.5">
                  {items.map((h) => (
                    <Link
                      key={h.id}
                      href={`/bible?book=${h.book}&chapter=${h.chapter}`}
                      className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm hover:bg-gray-50"
                    >
                      <span className="h-4 w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: h.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800">
                          {BIBLE_BOOKS[book]?.ko ?? book} {h.chapter}:{h.verse}
                        </p>
                        {h.memo ? <p className="truncate text-xs text-gray-400">{h.memo}</p> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
