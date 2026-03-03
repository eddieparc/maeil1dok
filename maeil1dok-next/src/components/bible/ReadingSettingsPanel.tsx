'use client'

import { useCallback, useEffect } from 'react'
import type { UserReadingSettings } from '@/types/profile'

interface ReadingSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: UserReadingSettings
  onSettingChange: (key: keyof UserReadingSettings, value: unknown) => void
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-dark)]'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--color-bg-secondary)] transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )
}

function OptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-info-bg)] text-[var(--color-primary)]'
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
      }`}
    >
      {label}
    </button>
  )
}

export default function ReadingSettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingChange,
}: ReadingSettingsPanelProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, isOpen])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <div className={`fixed inset-0 z-[100] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <button
        type="button"
        aria-label="읽기 설정 패널 닫기"
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`absolute right-0 top-0 h-full w-80 max-w-full bg-[var(--color-bg-secondary)] shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-4 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">읽기 설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            aria-label="읽기 설정 닫기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <title>닫기</title>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="h-[calc(100%-69px)] space-y-5 overflow-y-auto px-4 py-4">
          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">테마</p>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton active={settings.theme === 'light'} label="밝음" onClick={() => onSettingChange('theme', 'light')} />
              <OptionButton active={settings.theme === 'dark'} label="어둠" onClick={() => onSettingChange('theme', 'dark')} />
              <OptionButton active={settings.theme === 'system'} label="시스템" onClick={() => onSettingChange('theme', 'system')} />
            </div>
          </section>

          <section className="space-y-2">
            <label htmlFor="font-family" className="text-sm font-semibold text-[var(--color-text-primary)]">글꼴</label>
            <select
              id="font-family"
              value={settings.fontFamily}
              onChange={(event) => onSettingChange('fontFamily', event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="KoPub Batang">KoPub Batang</option>
              <option value="RIDI Batang">RIDI Batang</option>
              <option value="Noto Serif KR">Noto Serif KR</option>
              <option value="Pretendard">Pretendard</option>
              <option value="Noto Sans KR">Noto Sans KR</option>
              <option value="system">시스템</option>
            </select>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">글자 크기</p>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(event) => onSettingChange('fontSize', Number(event.target.value))}
              className="w-full"
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">줄 간격</p>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">{settings.lineHeight.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={1.4}
              max={2.4}
              step={0.1}
              value={settings.lineHeight}
              onChange={(event) => onSettingChange('lineHeight', Number(event.target.value))}
              className="w-full"
            />
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">글자 굵기</p>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton active={settings.fontWeight === 'normal'} label="보통" onClick={() => onSettingChange('fontWeight', 'normal')} />
              <OptionButton active={settings.fontWeight === '500'} label="중간" onClick={() => onSettingChange('fontWeight', '500')} />
              <OptionButton active={settings.fontWeight === 'bold'} label="굵게" onClick={() => onSettingChange('fontWeight', 'bold')} />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">텍스트 정렬</p>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton active={settings.textAlign === 'left'} label="왼쪽" onClick={() => onSettingChange('textAlign', 'left')} />
              <OptionButton active={settings.textAlign === 'justify'} label="양쪽" onClick={() => onSettingChange('textAlign', 'justify')} />
            </div>
          </section>

          <section className="space-y-1 border-t border-[var(--color-border-default)] pt-3">
            <Toggle
              checked={settings.showVerseNumbers}
              onChange={(next) => onSettingChange('showVerseNumbers', next)}
              label="절 번호 표시"
            />
            <Toggle
              checked={settings.verseJoining}
              onChange={(next) => onSettingChange('verseJoining', next)}
              label="절 이어보기"
            />
            <Toggle
              checked={settings.highlightNames}
              onChange={(next) => onSettingChange('highlightNames', next)}
              label="이름 강조"
            />
            <Toggle
              checked={settings.tongdokAutoComplete}
              onChange={(next) => onSettingChange('tongdokAutoComplete', next)}
              label="통독 자동 완료"
            />
          </section>
        </div>
      </aside>
    </div>
  )
}
