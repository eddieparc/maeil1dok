'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface Bookmark {
  id: string
  book: string
  chapter: number
  title?: string
  created_at: string
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bible/bookmarks')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { data?: Bookmark[] }) => setBookmarks(json.data ?? []))
      .catch(() => setBookmarks([]))
      .finally(() => setIsLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/bible/bookmarks?id=${id}`, { method: 'DELETE' })
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
          <Link href="/bible" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">북마크</h1>
        </header>

        <div className="px-4 pt-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : bookmarks.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">북마크가 없어요</p>
          ) : (
            <div className="flex flex-col gap-2">
              {bookmarks.map((bm) => (
                <div key={bm.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <Link
                    href={`/bible?book=${bm.book}&chapter=${bm.chapter}`}
                    className="flex-1"
                  >
                    <p className="font-medium text-gray-900">
                      {BIBLE_BOOKS[bm.book]?.ko ?? bm.book} {bm.chapter}장
                    </p>
                    {bm.title ? <p className="text-xs text-gray-400">{bm.title}</p> : null}
                  </Link>
                  <button
                    type="button"
                    className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="북마크 삭제"
                    onClick={() => void handleDelete(bm.id)}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
