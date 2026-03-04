'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useModal } from '@/hooks/useModal'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface Note {
  id: string
  user_id?: string
  book: string
  book_name?: string | null
  chapter: number
  start_verse?: number | null
  end_verse?: number | null
  content: string
  is_private: boolean
  created_at: string
  updated_at: string
}

export default function NoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const modal = useModal()
  const id = params && typeof params.id === 'string' ? params.id : ''

  const [note, setNote] = useState<Note | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editContent, setEditContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [originalContent, setOriginalContent] = useState('')
  const [originalPrivate, setOriginalPrivate] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return

    fetch(`/api/bible/notes/${id}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('failed to fetch note')
        }

        return response.json() as Promise<{ data?: Note }>
      })
      .then((json: { data?: Note }) => {
        const loadedNote = json.data ?? null
        setNote(loadedNote)
        setEditContent(loadedNote?.content ?? '')
        setIsPrivate(loadedNote?.is_private ?? true)
        setOriginalContent(loadedNote?.content ?? '')
        setOriginalPrivate(loadedNote?.is_private ?? true)
      })
      .catch(() => setNote(null))
      .finally(() => setIsLoading(false))
  }, [id])

  const hasChanges = useMemo(
    () => editContent !== originalContent || isPrivate !== originalPrivate,
    [editContent, isPrivate, originalContent, originalPrivate],
  )

  const formatDate = useCallback((value: string) => {
    const date = new Date(value)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!note || !hasChanges || isSaving) return

    setIsSaving(true)

    const res = await fetch(`/api/bible/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent, is_private: isPrivate }),
    })

    if (res.ok) {
      const json = (await res.json()) as { data?: Note }
      const updated = json.data
      if (updated) {
        setNote(updated)
        setEditContent(updated.content)
        setIsPrivate(updated.is_private)
        setOriginalContent(updated.content)
        setOriginalPrivate(updated.is_private)
      } else {
        const updatedAt = new Date().toISOString()
        setNote((prev) => (prev ? { ...prev, content: editContent, is_private: isPrivate, updated_at: updatedAt } : prev))
        setOriginalContent(editContent)
        setOriginalPrivate(isPrivate)
      }
    }

    setIsSaving(false)
  }, [editContent, hasChanges, id, isPrivate, isSaving, note])

  const handleContentChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(event.target.value)
    event.target.style.height = 'auto'
    event.target.style.height = `${event.target.scrollHeight}px`
  }, [])

  async function handleDelete() {
    const confirmed = await modal.confirm({
      title: '묵상노트 삭제',
      description: '묵상노트를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      confirmVariant: 'danger',
      icon: 'warning',
    })

    if (!confirmed) return

    await fetch(`/api/bible/notes/${id}`, { method: 'DELETE' })
    router.push('/bible/notes')
  }

  async function handleBack() {
    if (!hasChanges) {
      router.back()
      return
    }

    const confirmed = await modal.confirm({
      title: '변경사항 저장 안 됨',
      description: '저장하지 않은 변경사항이 있습니다. 나가시겠습니까?',
      confirmText: '나가기',
      cancelText: '취소',
      confirmVariant: 'danger',
      icon: 'warning',
    })

    if (confirmed) {
      router.back()
    }
  }

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    if (!hasChanges || isSaving) {
      return
    }

    saveTimeoutRef.current = setTimeout(() => {
      void handleSave()
    }, 3000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [handleSave, hasChanges, isSaving])

  function goToBible() {
    if (!note) return
    router.push(`/bible?book=${note.book}&chapter=${note.chapter}`)
  }

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]">
        <Loader2 size={28} className="animate-spin" aria-hidden="true" />
        <p className="text-sm">묵상노트를 불러오는 중...</p>
      </main>
    )
  }

  if (!note) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--color-bg-primary)] px-6">
        <div className="text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">묵상노트를 찾을 수 없습니다</p>
          <Link href="/bible/notes" className="mt-2 block text-sm text-[var(--color-accent-primary)]">목록으로 돌아가기</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[var(--color-bg-primary)] pb-24">
      <div className="mx-auto min-h-dvh max-w-[768px] bg-[var(--color-bg-primary)]">
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="-m-2 rounded-lg p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              onClick={() => void handleBack()}
              aria-label="뒤로 가기"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="flex-1 text-lg font-semibold text-[var(--color-text-primary)]">묵상노트</h1>
            <button
              type="button"
              className="-m-1 rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-red-500"
              onClick={() => void handleDelete()}
              aria-label="묵상노트 삭제"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="flex min-h-[calc(100dvh-80px)] flex-col px-4 py-4">
          <button
            type="button"
            onClick={goToBible}
            className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--color-bg-card)] px-3 py-3 text-[0.9375rem] font-medium text-[var(--color-accent-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>{note.book_name || BIBLE_BOOKS[note.book]?.ko || note.book} {note.chapter}장</span>
            <ChevronRight size={14} className="ml-auto text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>

          <div className="flex flex-1 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleContentChange}
              placeholder="묵상 내용을 적어보세요..."
              className="min-h-[300px] w-full flex-1 resize-none border-none bg-transparent text-base leading-7 text-[var(--color-text-primary)] outline-none"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => setIsPrivate(event.target.checked)}
                  className="peer sr-only"
                />
                <span className="relative h-7 w-12 rounded-full bg-[var(--color-border)] transition-colors peer-checked:bg-[var(--color-accent-primary)]">
                  <span className="absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-full bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] transition-transform peer-checked:translate-x-5" />
                </span>
                <span className="text-sm text-[var(--color-text-secondary)]">비공개</span>
              </label>
              <span className="text-xs text-[var(--color-text-muted)]">{formatDate(note.updated_at)} 수정됨</span>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasChanges || isSaving}
                className="inline-flex min-w-[104px] items-center justify-center gap-2 rounded-[10px] bg-[var(--color-accent-primary)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                <span>{hasChanges ? '저장' : '저장됨'}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
