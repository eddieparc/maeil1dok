'use client'

import type { CatchupScheduleOutput } from '@/lib/catchup/scheduling'
import { Modal, Button } from '@/components/ui'
import { useState } from 'react'

interface CatchupPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: CatchupScheduleOutput | null
  onConfirm: () => void
  isSubmitting: boolean
}

function formatDayDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`
}

export function CatchupPreviewModal({ isOpen, onClose, schedule, onConfirm, isSubmitting }: CatchupPreviewModalProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const toggleDay = (date: string) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(date)) {
      newExpanded.delete(date)
    } else {
      newExpanded.add(date)
    }
    setExpandedDays(newExpanded)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
         <h2 className="text-lg font-semibold text-gray-900">미리보기</h2>
         <button
           type="button"
           onClick={onClose}
           className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
           aria-label="닫기"
         >
           ✕
         </button>
       </Modal.Header>

      <Modal.Body>
        {schedule ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">이대로 진행하면...</p>

            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-lg">📚</span>
                <span className="text-sm text-gray-900">
                  총 <strong>{schedule.totalDays}일치</strong> 따라잡기
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">📈</span>
                <span className="text-sm text-gray-900">
                  하루 평균 <strong>약 {Math.ceil(schedule.days.length / schedule.totalDays)}회</strong>
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">⏱️</span>
                <span className="text-sm text-gray-900">
                  예상 소요: <strong>{schedule.totalDays}일</strong>
                </span>
              </div>
              <div className={`flex items-start gap-3 ${schedule.canComplete ? 'text-green-700' : 'text-amber-700'}`}>
                <span className="text-lg">{schedule.canComplete ? '✅' : '⚠️'}</span>
                <span className="text-sm font-medium">
                  {schedule.canComplete ? '목표일 내 완료 가능합니다.' : `목표일 이후 남는 일정: ${schedule.remainingAfterTarget.length}개`}
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">📅 일자별 계획</h4>
              <div className="space-y-1 border border-gray-100 rounded-xl overflow-hidden">
                {schedule.days.map((day, idx) => (
                   <div key={day.date.toISOString()} className={idx !== schedule.days.length - 1 ? 'border-b border-gray-100' : ''}>
                     <button
                       type="button"
                       onClick={() => toggleDay(day.date.toISOString())}
                       className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                     >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{formatDayDate(day.date.toISOString())}</span>
                        <span className="text-xs text-gray-600">{day.schedules.length}회</span>
                      </div>
                      <span className="text-xs text-gray-500">{expandedDays.has(day.date.toISOString()) ? '▼' : '▶'}</span>
                    </button>
                    {expandedDays.has(day.date.toISOString()) && (
                      <div className="bg-gray-50 px-4 py-2 space-y-1 border-t border-gray-100">
                        {day.schedules.map((entry) => (
                          <p key={entry.id} className="text-xs text-gray-700">
                            • {entry.book} {entry.startChapter}장{entry.startChapter !== entry.endChapter ? `-${entry.endChapter}장` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">미리보기 데이터가 없습니다.</p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="flex w-full gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            다시설정
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={isSubmitting}
            disabled={!schedule || isSubmitting}
            className="flex-1"
          >
            시작하기 🚀
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
