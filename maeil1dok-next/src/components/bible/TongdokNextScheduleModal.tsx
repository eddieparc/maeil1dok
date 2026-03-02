'use client'

interface ScheduleItem {
  book: string
  chapter: number
  bookName: string
}

interface TongdokNextScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  scheduleDate: string
  scheduleItems: ScheduleItem[]
  onGoToReading: (book: string, chapter: number) => void
}

export default function TongdokNextScheduleModal({
  isOpen,
  onClose,
  scheduleDate,
  scheduleItems,
  onGoToReading,
}: TongdokNextScheduleModalProps) {
  if (!isOpen) return null

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/50" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <h2 className="mt-4 text-center text-lg font-bold text-gray-900">다음 일정</h2>
        <p className="mt-1 text-center text-sm text-gray-400">{scheduleDate}</p>

        <div className="mt-4 flex flex-col gap-2">
          {scheduleItems.map((item) => (
            <button
              key={`${item.book}-${item.chapter}`}
              type="button"
              className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50"
              onClick={() => { onGoToReading(item.book, item.chapter); onClose() }}
            >
              <span className="font-medium text-gray-800">
                {item.bookName} {item.chapter}장
              </span>
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </>
  )
}
