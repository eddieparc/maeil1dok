'use client'

import type { CatchupScheduleOutput } from '@/lib/catchup/scheduling'
import { Modal, Button } from '@/components/ui'

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
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">캐치업 미리보기</h2>
      </Modal.Header>
      <Modal.Body>
        {schedule ? (
          <>
            <div className="rounded-xl bg-[var(--color-bg-tertiary)] p-3 text-sm text-[var(--color-text-secondary)]">
              <p>
                예상 소요일: <strong>{schedule.totalDays}일</strong>
              </p>
              <p className={schedule.canComplete ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>
                {schedule.canComplete ? '목표일 내 완료 가능합니다.' : `목표일 이후 남는 일정: ${schedule.remainingAfterTarget.length}개`}
              </p>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {schedule.days.map((day) => (
                <div key={day.date.toISOString()} className="rounded-xl border border-[var(--color-border-default)] p-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatDate(day.date)}</p>
                  <ul className="mt-1 space-y-1 text-sm text-[var(--color-text-tertiary)]">
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
          <p className="text-sm text-[var(--color-text-tertiary)]">미리보기 데이터가 없습니다.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={!schedule}
            className="flex-1"
          >
            캐치업 시작
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
