'use client'

import { useState } from 'react'

interface NoteQuickModalProps {
  isOpen: boolean
  onClose: () => void
  book: string
  chapter: number
  verse?: number
  onSave: (content: string, isPrivate: boolean) => void
}

export default function NoteQuickModal({ isOpen, onClose, book, chapter, verse, onSave }: NoteQuickModalProps) {
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  if (!isOpen) return null

  function handleSave() {
    if (!content.trim()) return
    onSave(content.trim(), isPrivate)
    setContent('')
    setIsPrivate(false)
    onClose()
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white px-4 pb-8 pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            노트 추가
            {verse ? <span className="ml-1 text-sm font-normal text-gray-400">{chapter}:{verse}</span> : null}
          </h3>
          <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="닫기">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <textarea
          className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
          rows={5}
          placeholder="노트를 입력하세요..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        />

        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded accent-blue-600"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span className="text-sm text-gray-600">비공개</span>
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={!content.trim()}
          >
            저장
          </button>
        </div>
      </div>
    </>
  )
}
