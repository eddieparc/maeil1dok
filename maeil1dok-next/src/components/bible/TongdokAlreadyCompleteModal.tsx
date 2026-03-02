'use client'

interface TongdokAlreadyCompleteModalProps {
  isOpen: boolean
  onClose: () => void
  onGoToNext: () => void
  nextScheduleDate?: string
}

export default function TongdokAlreadyCompleteModal({
  isOpen,
  onClose,
  onGoToNext,
  nextScheduleDate,
}: TongdokAlreadyCompleteModalProps) {
  if (!isOpen) return null

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/50" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h2 className="mt-4 text-center text-lg font-bold text-gray-900">이미 오늘 분량을 완료했어요!</h2>
        {nextScheduleDate ? (
          <p className="mt-2 text-center text-sm text-gray-500">
            다음 분량: {nextScheduleDate}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={onGoToNext}
          >
            다음 일정으로 이동
          </button>
          <button
            type="button"
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </>
  )
}
