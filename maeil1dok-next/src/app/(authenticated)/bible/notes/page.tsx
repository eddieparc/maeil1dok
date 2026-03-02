'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface Note {
  id: string
  book: string
  chapter: number
  start_verse?: number
  content: string
  is_private?: boolean
  created_at: string
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bible/notes')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { data?: Note[] }) => setNotes(json.data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
          <Link href="/bible" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">노트</h1>
        </header>

        <div className="px-4 pt-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : notes.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">노트가 없어요</p>
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/bible/notes/${note.id}`}
                  className="block rounded-2xl bg-white px-4 py-3 shadow-sm hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">
                      {BIBLE_BOOKS[note.book]?.ko ?? note.book} {note.chapter}장
                      {note.start_verse ? ` ${note.start_verse}절` : ''}
                    </p>
                    {note.is_private ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">비공개</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-800">{note.content}</p>
                  <p className="mt-1 text-xs text-gray-400">{new Date(note.created_at).toLocaleDateString('ko-KR')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
