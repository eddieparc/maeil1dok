'use client'

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
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button type="button" onClick={onClose} aria-label="캐치업 설정 닫기" className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5" role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold text-gray-900">캐치업 설정</h2>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">전략</p>
            <label className="mb-2 block rounded-xl border border-gray-200 px-3 py-2">
              <input
                type="radio"
                name="strategy"
                checked={value.strategy === 'parallel'}
                onChange={() => onChange({ ...value, strategy: 'parallel' })}
              />
              <span className="ml-2 text-sm text-gray-900">병렬 (각 플랜을 균등하게 분배)</span>
            </label>
            <label className="block rounded-xl border border-gray-200 px-3 py-2">
              <input
                type="radio"
                name="strategy"
                checked={value.strategy === 'sequential'}
                onChange={() => onChange({ ...value, strategy: 'sequential' })}
              />
              <span className="ml-2 text-sm text-gray-900">순차 (앞선 날짜부터 순서대로)</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">재합류 목표일</span>
            <input
              type="date"
              value={value.targetDate}
              onChange={(event) => onChange({ ...value, targetDate: event.target.value })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">일일 최대 읽기 수</span>
            <input
              type="number"
              min={1}
              value={value.maxDailyReadings}
              onChange={(event) => onChange({ ...value, maxDailyReadings: Number(event.target.value) || 1 })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">일일 최대 장 수</span>
            <input
              type="number"
              min={1}
              value={value.maxDailyChapters}
              onChange={(event) => onChange({ ...value, maxDailyChapters: Number(event.target.value) || 1 })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">주말 배수</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={value.weekendMultiplier}
              onChange={(event) => onChange({ ...value, weekendMultiplier: Number(event.target.value) || 1 })}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2 text-sm text-gray-700">
            취소
          </button>
          <button
            type="button"
            onClick={() => onPreview(value)}
            className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white"
          >
            미리보기
          </button>
        </div>
      </div>
    </div>
  )
}
