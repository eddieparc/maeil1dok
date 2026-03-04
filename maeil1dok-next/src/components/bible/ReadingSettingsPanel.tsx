'use client'

import { useCallback, useEffect } from 'react'
import type { UserReadingSettings } from '@/types/profile'
import { cn } from '@/lib/utils'

interface ReadingSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: UserReadingSettings
  onSettingChange: (key: keyof UserReadingSettings, value: unknown) => void
}

type ThemeMode = UserReadingSettings['theme']
type FontWeight = 'normal' | 'medium' | 'bold'
type TextAlign = 'left' | 'justify'

const FONT_OPTIONS = [
  { value: 'kopub-batang', label: 'KoPub Batang', css: '"KoPub Batang", serif' },
  { value: 'ridi-batang', label: 'RIDI Batang', css: '"RIDIBatang", serif' },
  { value: 'noto-serif', label: 'Noto Serif KR', css: '"Noto Serif KR", serif' },
  { value: 'pretendard', label: 'Pretendard', css: '"Pretendard", sans-serif' },
  { value: 'noto-sans', label: 'Noto Sans KR', css: '"Noto Sans KR", sans-serif' },
  {
    value: 'system',
    label: 'System',
    css: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
] as const

const FONT_WEIGHT_OPTIONS: ReadonlyArray<{ value: FontWeight; label: string }> = [
  { value: 'normal', label: '보통' },
  { value: 'medium', label: '중간' },
  { value: 'bold', label: '굵게' },
]

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템' },
]

const ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '왼쪽' },
  { value: 'justify', label: '양쪽' },
]

function normalizeFontFamily(value: string): (typeof FONT_OPTIONS)[number]['value'] {
  if (value === 'KoPub Batang') return 'kopub-batang'
  if (value === 'RIDI Batang') return 'ridi-batang'
  if (value === 'Noto Serif KR') return 'noto-serif'
  if (value === 'Pretendard') return 'pretendard'
  if (value === 'Noto Sans KR') return 'noto-sans'
  if (value === 'system' || value === 'System') return 'system'

  if (FONT_OPTIONS.some((font) => font.value === value)) {
    return value as (typeof FONT_OPTIONS)[number]['value']
  }

  return 'kopub-batang'
}

function resolveFontCss(value: string) {
  const normalized = normalizeFontFamily(value)
  return FONT_OPTIONS.find((font) => font.value === normalized)?.css ?? FONT_OPTIONS[0].css
}

function normalizeFontWeight(value: string): FontWeight {
  if (value === '500') return 'medium'
  if (value === 'normal' || value === 'medium' || value === 'bold') {
    return value
  }
  return 'medium'
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        {description ? (
          <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked
            ? 'bg-[var(--color-accent-primary)]'
            : 'bg-[var(--color-border-default)]',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
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
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]'
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent-primary)]',
      )}
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

  const normalizedFamily = normalizeFontFamily(settings.fontFamily)
  const normalizedWeight = normalizeFontWeight(settings.fontWeight)

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
        className={`absolute right-0 top-0 h-full w-[22rem] max-w-full bg-[var(--color-bg-secondary)] shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="h-[calc(100%-69px)] space-y-5 overflow-y-auto px-4 py-4">
          <section className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-primary)] p-3">
            <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">미리보기</p>
            <p
              className="text-sm text-[var(--color-text-primary)]"
              style={{
                fontFamily: resolveFontCss(settings.fontFamily),
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                fontWeight: normalizedWeight === 'normal' ? 400 : normalizedWeight === 'medium' ? 500 : 600,
                textAlign: settings.textAlign as TextAlign,
              }}
            >
              태초에 하나님이 천지를 창조하시니라
            </p>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">테마</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={settings.theme === option.value}
                  label={option.label}
                  onClick={() => onSettingChange('theme', option.value)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">글꼴</p>
            <div className="grid grid-cols-2 gap-2">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => onSettingChange('fontFamily', font.value)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs transition',
                    normalizedFamily === font.value
                      ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]'
                      : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
                  )}
                >
                  <span className="block text-lg" style={{ fontFamily: font.css }}>가</span>
                  <span className="block text-[11px]">{font.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">글자 크기</p>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(event) => onSettingChange('fontSize', Number(event.target.value))}
              className="reading-settings-slider w-full"
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
              className="reading-settings-slider w-full"
            />
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">글자 굵기</p>
            <div className="grid grid-cols-3 gap-2">
              {FONT_WEIGHT_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={normalizedWeight === option.value}
                  label={option.label}
                  onClick={() => onSettingChange('fontWeight', option.value)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">텍스트 정렬</p>
            <div className="grid grid-cols-2 gap-2">
              {ALIGN_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={settings.textAlign === option.value}
                  label={option.label}
                  onClick={() => onSettingChange('textAlign', option.value)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-1 border-t border-[var(--color-border-default)] pt-3">
            <ToggleRow
              checked={settings.verseJoining}
              onChange={(next) => onSettingChange('verseJoining', next)}
              title="절 붙임"
              description="절을 이어서 읽기"
            />
            <ToggleRow
              checked={settings.showVerseNumbers}
              onChange={(next) => onSettingChange('showVerseNumbers', next)}
              title="절 번호 표시"
            />
            <ToggleRow
              checked={settings.tongdokAutoComplete}
              onChange={(next) => onSettingChange('tongdokAutoComplete', next)}
              title="통독 자동 완료"
            />
            <ToggleRow
              checked={settings.showDescription}
              onChange={(next) => onSettingChange('showDescription', next)}
              title="소제목 표시"
            />
            <ToggleRow
              checked={settings.showCrossRef}
              onChange={(next) => onSettingChange('showCrossRef', next)}
              title="교차 참조"
            />
            <ToggleRow
              checked={settings.showFootnotes}
              onChange={(next) => onSettingChange('showFootnotes', next)}
              title="각주 표시"
            />
          </section>
        </div>
      </aside>
    </div>
  )
}
