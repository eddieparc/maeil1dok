'use client'

import type { CatchupScheduleOutput } from '@/lib/catchup/scheduling'

interface CatchupPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: CatchupScheduleOutput | null
  onConfirm: () => void
  isSubmitting: boolean
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

export function CatchupPreviewModal({ isOpen, onClose, schedule, onConfirm, isSubmitting }: CatchupPreviewModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" onClick={onClose} aria-label="캐치업 미리보기 닫기" className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5" role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold text-gray-900">캐치업 미리보기</h2>

        {schedule ? (
          <>
            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              <p>
                예상 소요일: <strong>{schedule.totalDays}일</strong>
              </p>
              <p className={schedule.canComplete ? 'text-emerald-700' : 'text-amber-700'}>
                {schedule.canComplete ? '목표일 내 완료 가능합니다.' : `목표일 이후 남는 일정: ${schedule.remainingAfterTarget.length}개`}
              </p>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {schedule.days.map((day) => (
                <div key={day.date.toISOString()} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-sm font-semibold text-gray-900">{formatDate(day.date)}</p>
                  <ul className="mt-1 space-y-1 text-sm text-gray-600">
                    {day.schedules.map((entry) => (
                      <li key={entry.id}>
                        {entry.book} {entry.startChapter}장-{entry.endChapter}장
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-500">미리보기 데이터가 없습니다.</p>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2 text-sm text-gray-700">
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !schedule}
            className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? '생성 중...' : '캐치업 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}
