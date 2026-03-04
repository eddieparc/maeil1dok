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
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-sm -translate-y-1/2 overflow-hidden rounded-3xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55)]">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 pb-8 pt-8 text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>다음 일정</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Next Step</p>
          <h2 className="mt-1 text-center text-xl font-extrabold">다음 통독 일정</h2>
          <p className="mt-2 text-center text-sm text-amber-50/90">{scheduleDate}</p>
        </div>

        <div className="px-6 pb-6 pt-4">
          {scheduleItems.length > 0 ? (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {scheduleItems.map((item) => (
                <button
                  key={`${item.book}-${item.chapter}`}
                  type="button"
                  className="group flex items-center justify-between rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-4 py-3 text-left transition hover:border-amber-400/70 hover:bg-[var(--color-bg-tertiary)] dark:hover:border-amber-500/50"
                  onClick={() => {
                    onGoToReading(item.book, item.chapter)
                    onClose()
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.bookName} {item.chapter}장</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">읽으러 이동</p>
                  </div>
                  <svg className="h-4 w-4 text-[var(--color-text-muted)] transition group-hover:translate-x-0.5 group-hover:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <title>이동</title>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              이동할 다음 일정이 아직 없어요
            </div>
          )}

          <button
            type="button"
            className="mt-4 w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </>
  )
}
