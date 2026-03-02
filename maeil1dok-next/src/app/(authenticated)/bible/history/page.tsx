'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface ReadRecord {
  book: string
  chapter: number
  read_date: string
}

interface BookProgress {
  book: string
  read: number
  total: number
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ReadRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bible/personal-records')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { data?: ReadRecord[] }) => setRecords(json.data ?? []))
      .catch(() => setRecords([]))
      .finally(() => setIsLoading(false))
  }, [])

  // Group by book for progress display
  const bookProgress: BookProgress[] = Object.entries(
    records.reduce<Record<string, Set<number>>>((acc, rec) => {
      if (!acc[rec.book]) acc[rec.book] = new Set()
      acc[rec.book].add(rec.chapter)
      return acc
    }, {})
  ).map(([book, chapters]) => ({
    book,
    read: chapters.size,
    total: BIBLE_BOOKS[book]?.chapters ?? 0,
  }))

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
          <Link href="/bible" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">읽기 기록</h1>
        </header>

        <div className="px-4 pt-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : bookProgress.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">아직 읽은 기록이 없어요</p>
          ) : (
            <div className="flex flex-col gap-2">
              {bookProgress.map((bp) => (
                <Link
                  key={bp.book}
                  href={`/bible?book=${bp.book}&chapter=1`}
                  className="block rounded-2xl bg-white px-4 py-3 shadow-sm hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">{BIBLE_BOOKS[bp.book]?.ko ?? bp.book}</p>
                    <p className="text-sm text-gray-500">{bp.read}/{bp.total}장</p>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${bp.total > 0 ? (bp.read / bp.total) * 100 : 0}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
