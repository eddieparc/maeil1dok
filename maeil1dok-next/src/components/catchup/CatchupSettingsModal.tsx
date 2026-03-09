'use client'

import { useId } from 'react'
import { Modal, Button } from '@/components/ui'

export interface CatchupSettings {
  strategy: 'parallel' | 'sequential'
  targetDate: string
  maxDailyReadings: number
  maxDailyChapters: number
  weekendMultiplier: number
}

interface CatchupSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onPreview: (settings: CatchupSettings) => void
  value: CatchupSettings
  onChange: (next: CatchupSettings) => void
}

export function CatchupSettingsModal({ isOpen, onClose, onPreview, value, onChange }: CatchupSettingsModalProps) {
  const targetDateId = useId()
  const maxDailyReadingsId = useId()
  const maxDailyChaptersId = useId()
  const weekendMultiplierId = useId()

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
        <h2 className="text-lg font-semibold text-gray-900">따라잡기 계획 세우기</h2>
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
        <div className="space-y-5">
           {/* Strategy Selection */}
           <fieldset>
             <legend className="mb-3 block text-sm font-semibold text-gray-900">진행 방식</legend>
             <div className="grid grid-cols-2 gap-3">
               <button
                 type="button"
                 onClick={() => onChange({ ...value, strategy: 'parallel' })}
                 className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                   value.strategy === 'parallel'
                     ? 'border-blue-600 bg-blue-50'
                     : 'border-gray-200 bg-white hover:border-gray-300'
                 }`}
               >
                 <span className="text-2xl">↔️</span>
                 <span className={`text-sm font-medium ${value.strategy === 'parallel' ? 'text-blue-600' : 'text-gray-900'}`}>
                   동시 진행
                 </span>
               </button>
               <button
                 type="button"
                 onClick={() => onChange({ ...value, strategy: 'sequential' })}
                 className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                   value.strategy === 'sequential'
                     ? 'border-blue-600 bg-blue-50'
                     : 'border-gray-200 bg-white hover:border-gray-300'
                 }`}
               >
                 <span className="text-2xl">→</span>
                 <span className={`text-sm font-medium ${value.strategy === 'sequential' ? 'text-blue-600' : 'text-gray-900'}`}>
                   순차 복귀
                 </span>
               </button>
             </div>
             <p className="mt-2 text-xs text-gray-600">
               {value.strategy === 'parallel'
                 ? '오늘 읽기와 밀린 읽기를 동시에 진행'
                 : '밀린 것부터 순서대로 읽고 원래 위치로 복귀'}
             </p>
           </fieldset>

           {/* Target Date */}
           <div>
             <label htmlFor={targetDateId} className="mb-2 block text-sm font-semibold text-gray-900">목표 복귀일</label>
             <input
               id={targetDateId}
               type="date"
               value={value.targetDate}
               onChange={(e) => onChange({ ...value, targetDate: e.target.value })}
               className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
             />
           </div>

           {/* Daily Readings */}
           <fieldset>
             <legend className="mb-2 block text-sm font-semibold text-gray-900">하루 최대 읽기량</legend>
             <div className="flex items-center gap-2">
               <label htmlFor={maxDailyReadingsId} className="sr-only">최대 읽기 횟수</label>
               <input
                 id={maxDailyReadingsId}
                 type="number"
                 min={1}
                 max={10}
                 value={value.maxDailyReadings}
                 onChange={(e) => onChange({ ...value, maxDailyReadings: Number(e.target.value) || 1 })}
                 className="w-20 rounded-xl border border-gray-300 bg-white px-3 py-2 text-center text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
               />
               <span className="text-sm text-gray-600">회</span>
               <span className="text-xs text-gray-500">또는</span>
               <label htmlFor={maxDailyChaptersId} className="sr-only">최대 읽기 장수</label>
               <input
                 id={maxDailyChaptersId}
                 type="number"
                 min={1}
                 max={50}
                 value={value.maxDailyChapters}
                 onChange={(e) => onChange({ ...value, maxDailyChapters: Number(e.target.value) || 1 })}
                 className="w-20 rounded-xl border border-gray-300 bg-white px-3 py-2 text-center text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
               />
               <span className="text-sm text-gray-600">장</span>
             </div>
           </fieldset>

           {/* Weekend Multiplier */}
           <div>
             <label htmlFor={weekendMultiplierId} className="mb-2 block text-sm font-semibold text-gray-900">주말 배수</label>
             <input
               id={weekendMultiplierId}
               type="number"
               min={0.5}
               step={0.5}
               value={value.weekendMultiplier}
               onChange={(e) => onChange({ ...value, weekendMultiplier: Number(e.target.value) || 1 })}
               className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
             />
           </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex w-full gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            variant="primary"
            onClick={() => onPreview(value)}
            className="flex-1"
          >
            미리보기
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
