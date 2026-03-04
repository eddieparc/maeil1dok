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
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-sm -translate-y-1/2 overflow-hidden rounded-3xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55)]">
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 px-6 pb-8 pt-8 text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>완료됨</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Already Done</p>
          <h2 className="mt-1 text-center text-xl font-extrabold">이미 오늘 분량을 완료했어요!</h2>
          <p className="mt-2 text-center text-sm text-cyan-50/90">오늘의 읽음 기록은 안전하게 저장됐어요</p>
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-4 py-3">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">완료 상태</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              완료됨
            </span>
          </div>

          {nextScheduleDate ? (
            <p className="mt-3 rounded-xl bg-[var(--color-bg-primary)] px-3 py-2 text-center text-sm text-[var(--color-text-primary)]">
              다음 분량: <span className="font-semibold">{nextScheduleDate}</span>
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_-12px_rgba(14,116,144,0.9)] transition hover:from-blue-600 hover:to-cyan-700"
              onClick={onGoToNext}
            >
              다음 일정으로 이동
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
