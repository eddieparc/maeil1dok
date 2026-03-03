'use client'

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
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <Modal.Header>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">캐치업 설정</h2>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">전략</p>
            <label className="mb-2 block rounded-xl border border-[var(--color-border-default)] px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-tertiary)]">
              <input
                type="radio"
                name="strategy"
                checked={value.strategy === 'parallel'}
                onChange={() => onChange({ ...value, strategy: 'parallel' })}
              />
              <span className="ml-2 text-sm text-[var(--color-text-primary)]">병렬 (각 플랜을 균등하게 분배)</span>
            </label>
            <label className="block rounded-xl border border-[var(--color-border-default)] px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-tertiary)]">
              <input
                type="radio"
                name="strategy"
                checked={value.strategy === 'sequential'}
                onChange={() => onChange({ ...value, strategy: 'sequential' })}
              />
              <span className="ml-2 text-sm text-[var(--color-text-primary)]">순차 (앞선 날짜부터 순서대로)</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">재합류 목표일</span>
            <input
              type="date"
              value={value.targetDate}
              onChange={(event) => onChange({ ...value, targetDate: event.target.value })}
              className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">일일 최대 읽기 수</span>
            <input
              type="number"
              min={1}
              value={value.maxDailyReadings}
              onChange={(event) => onChange({ ...value, maxDailyReadings: Number(event.target.value) || 1 })}
              className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">일일 최대 장 수</span>
            <input
              type="number"
              min={1}
              value={value.maxDailyChapters}
              onChange={(event) => onChange({ ...value, maxDailyChapters: Number(event.target.value) || 1 })}
              className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">주말 배수</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={value.weekendMultiplier}
              onChange={(event) => onChange({ ...value, weekendMultiplier: Number(event.target.value) || 1 })}
              className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>
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
