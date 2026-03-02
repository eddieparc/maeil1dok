'use client'

import { useState } from 'react'

const DEFAULT_COLORS = ['#FFEB3B', '#A5D6A7', '#90CAF9', '#F48FB1', '#FFCC80', '#CE93D8']

interface HighlightModalProps {
  isOpen: boolean
  onClose: () => void
  selectedColor?: string
  customColors?: string[]
  onSave: (color: string, memo?: string) => void
  onDelete?: () => void
}

export default function HighlightModal({
  isOpen,
  onClose,
  selectedColor,
  customColors = [],
  onSave,
  onDelete,
}: HighlightModalProps) {
  const [color, setColor] = useState(selectedColor ?? DEFAULT_COLORS[0])
  const [memo, setMemo] = useState('')

  if (!isOpen) return null

  const allColors = [...new Set([...customColors, ...DEFAULT_COLORS])]

  function handleSave() {
    onSave(color, memo.trim() || undefined)
    setMemo('')
    onClose()
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white px-4 pb-8 pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">하이라이트</h3>
          <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="닫기">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {allColors.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-9 w-9 rounded-full border-2 transition ${color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              aria-label={`색상 ${c}`}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <input
          type="text"
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
          placeholder="메모 (선택사항)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <div className="mt-4 flex gap-2">
          {onDelete ? (
            <button
              type="button"
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              onClick={() => { onDelete(); onClose() }}
            >
              삭제
            </button>
          ) : null}
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={handleSave}
          >
            적용
          </button>
        </div>
      </div>
    </>
  )
}
