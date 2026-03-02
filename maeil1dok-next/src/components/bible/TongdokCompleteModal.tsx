'use client'

import { useState } from 'react'

interface TongdokCompleteModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleRange: string
  initialAutoComplete?: boolean
  isLoading?: boolean
  onConfirm: (autoComplete: boolean) => void
}

export default function TongdokCompleteModal({
  isOpen,
  onClose,
  scheduleRange,
  initialAutoComplete = false,
  isLoading = false,
  onConfirm,
}: TongdokCompleteModalProps) {
  const [autoComplete, setAutoComplete] = useState(initialAutoComplete)

  if (!isOpen) return null

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/50" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2.5 2.5L16 9" />
            </svg>
          </div>
        </div>

        <h2 className="mt-4 text-center text-lg font-bold text-gray-900">오늘 분량을 다 읽으셨나요?</h2>
        <p className="mt-2 text-center text-sm text-gray-500">{scheduleRange}</p>

        <label className="mt-4 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded accent-emerald-600"
            checked={autoComplete}
            onChange={(e) => setAutoComplete(e.target.checked)}
          />
          <span className="text-sm text-gray-600">다음부터 자동으로 완료 처리</span>
        </label>

        {autoComplete ? (
          <p className="mt-1.5 text-xs text-gray-400">설정 &gt; 읽기 설정에서 변경할 수 있습니다</p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => onConfirm(autoComplete)}
            disabled={isLoading}
          >
            {isLoading ? '처리 중...' : '완료 처리'}
          </button>
        </div>
      </div>
    </>
  )
}
