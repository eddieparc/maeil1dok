'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface Note {
  id: string
  book: string
  chapter: number
  start_verse?: number
  content: string
  is_private?: boolean
  created_at: string
  updated_at?: string
}

export default function NoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params && typeof params.id === 'string' ? params.id : ''

  const [note, setNote] = useState<Note | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/bible/notes/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((json: { data?: Note }) => {
        setNote(json.data ?? null)
        setEditContent(json.data?.content ?? '')
      })
      .catch(() => setNote(null))
      .finally(() => setIsLoading(false))
  }, [id])

  async function handleSave() {
    if (!note) return
    const res = await fetch(`/api/bible/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    })
    if (res.ok) {
      setNote((prev) => prev ? { ...prev, content: editContent } : prev)
      setIsEditing(false)
    }
  }

  async function handleDelete() {
    await fetch(`/api/bible/notes/${id}`, { method: 'DELETE' })
    router.push('/bible/notes')
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50"><p className="text-sm text-gray-400">불러오는 중...</p></main>
  }

  if (!note) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-gray-500">노트를 찾을 수 없어요</p>
          <Link href="/bible/notes" className="mt-2 block text-sm text-blue-600">목록으로</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center justify-between bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Link href="/bible/notes" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18L9 12L15 6" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-gray-900">노트</h1>
          </div>
          <div className="flex gap-1">
            {!isEditing ? (
              <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50" onClick={() => setIsEditing(true)}>편집</button>
            ) : null}
            <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50" onClick={() => void handleDelete()}>삭제</button>
          </div>
        </header>

        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-blue-600">
              {BIBLE_BOOKS[note.book]?.ko ?? note.book} {note.chapter}장
              {note.start_verse ? ` ${note.start_verse}절` : ''}
            </p>

            {isEditing ? (
              <>
                <textarea
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  rows={10}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700" onClick={() => setIsEditing(false)}>취소</button>
                  <button type="button" className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white" onClick={() => void handleSave()}>저장</button>
                </div>
              </>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{note.content}</p>
            )}

            <p className="mt-3 text-xs text-gray-400">{new Date(note.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
