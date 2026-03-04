'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import {
  FONT_FAMILIES,
  FONT_FAMILY_ORDER,
  FONT_WEIGHTS,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  type FontWeight,
  type TextAlign,
  type ThemeMode,
} from '@/hooks/bible/ReadingSettingsContext'
import { cn } from '@/lib/utils'
import { useScrollLock } from '@/hooks/useScrollLock'

/* ─── Icons (inline SVG for zero-dep) ─── */

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
      <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-transform duration-200', expanded && 'rotate-180')}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/* ─── Toggle Switch ─── */

function ToggleSwitch({
  checked,
  onChange,
  small,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  small?: boolean
}) {
  const w = small ? 'w-9' : 'w-11'
  const h = small ? 'h-5' : 'h-6'
  const dot = small ? 'h-3.5 w-3.5' : 'h-5 w-5'
  const translate = small ? 'translate-x-4' : 'translate-x-5'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        w, h,
        checked ? 'bg-[var(--color-accent-primary)]' : 'bg-[var(--color-border-default)]'
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200',
          dot,
          checked ? translate : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

/* ─── Theme options ─── */

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; Icon: () => React.ReactElement }> = [
  { value: 'light', label: '라이트', Icon: SunIcon },
  { value: 'dark', label: '다크', Icon: MoonIcon },
  { value: 'system', label: '자동', Icon: MonitorIcon },
]

const WEIGHT_OPTIONS: Array<{ value: FontWeight; label: string }> = [
  { value: 'normal', label: '보통' },
  { value: 'medium', label: '중간' },
  { value: 'bold', label: '굵게' },
]

const ALIGN_OPTIONS: Array<{ value: TextAlign; label: string; icon: React.ReactNode }> = [
  {
    value: 'left',
    label: '왼쪽',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
      </svg>
    ),
  },
  {
    value: 'justify',
    label: '양쪽',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
]

/* ─── Main component ─── */

interface ReadingSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReadingSettingsModal({ isOpen, onClose }: ReadingSettingsModalProps) {
  const { settings, updateSetting, resetSettings } = useReadingSettings()
  const [isMounted, setIsMounted] = useState(false)
  const [isRendered, setIsRendered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [expandedSections, setExpandedSections] = useState({ typography: true, readingMode: false })
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useScrollLock(isRendered)

  useEffect(() => {
    setIsMounted(true)
    return () => {
      if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setIsRendered(true)
      setExpandedSections({ typography: true, readingMode: false })
      const frame = requestAnimationFrame(() => setIsVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    setIsVisible(false)
    closeTimeoutRef.current = setTimeout(() => {
      setIsRendered(false)
      closeTimeoutRef.current = null
    }, 300)

    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
    }
  }, [isOpen])

  const fontFamilyList = useMemo(
    () => FONT_FAMILY_ORDER.map((key) => ({ key, ...FONT_FAMILIES[key] })),
    [],
  )

  function toggleSection(section: 'typography' | 'readingMode') {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  if (!isMounted || !isRendered) return null

  const effectiveTheme = settings.theme === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col justify-end',
        'transition-opacity duration-300 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className={cn(
          'relative z-10 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl',
          'bg-[var(--color-bg-primary)] shadow-xl',
          'transition-transform duration-300 ease-out',
          isVisible ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Drag handle + header */}
        <div className="shrink-0 px-5 pt-3 pb-0">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border-default)]" />
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">읽기 설정</h3>
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-button-default)]"
              onClick={onClose}
              aria-label="닫기"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div className="shrink-0 mx-4 mb-2 rounded-xl border border-[var(--color-border-default)] overflow-hidden">
          <div
            className="px-4 py-3 transition-colors duration-200"
            style={{
              backgroundColor: effectiveTheme === 'dark' ? '#1a1a1a' : '#f9fafb',
            }}
          >
            <p
              className="mb-1 text-center text-sm font-semibold"
              style={{ color: effectiveTheme === 'dark' ? '#8ba888' : '#4a5d4a' }}
            >
              예수 그리스도의 계보
              <span className="ml-1 text-xs font-normal opacity-60">(마 1:1-3)</span>
            </p>
            <div
              style={{
                fontFamily: FONT_FAMILIES[settings.fontFamily].css,
                fontSize: `${settings.fontSize}px`,
                fontWeight: FONT_WEIGHTS[settings.fontWeight],
                lineHeight: settings.lineHeight,
                textAlign: settings.textAlign,
                color: effectiveTheme === 'dark' ? '#e0e0e0' : '#1f2937',
              }}
            >
              {settings.verseJoining ? (
                <p className="m-0">
                  {settings.showVerseNumbers ? (
                    <sup className="mr-0.5 text-[0.6em] opacity-50" style={{ fontFamily: 'sans-serif' }}>1</sup>
                  ) : null}
                  아브라함과 다윗의 자손 예수 그리스도의 계보라{' '}
                  {settings.showVerseNumbers ? (
                    <sup className="mr-0.5 text-[0.6em] opacity-50" style={{ fontFamily: 'sans-serif' }}>2</sup>
                  ) : null}
                  아브라함이 이삭을 낳고 이삭은 야곱을 낳고
                </p>
              ) : (
                <>
                  <p className="m-0 flex gap-1.5">
                    {settings.showVerseNumbers ? (
                      <span className="shrink-0 text-[0.7em] font-medium opacity-40" style={{ fontFamily: 'sans-serif', lineHeight: '2' }}>1</span>
                    ) : null}
                    <span>아브라함과 다윗의 자손 예수 그리스도의 계보라</span>
                  </p>
                  <p className="m-0 flex gap-1.5">
                    {settings.showVerseNumbers ? (
                      <span className="shrink-0 text-[0.7em] font-medium opacity-40" style={{ fontFamily: 'sans-serif', lineHeight: '2' }}>2</span>
                    ) : null}
                    <span>아브라함이 이삭을 낳고 이삭은 야곱을 낳고</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable settings body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Theme section (always visible) */}
          <section className="border-b border-[var(--color-border-light)] px-4 py-3">
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2.5 text-[13px] font-medium transition-all',
                    settings.theme === value
                      ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]'
                      : 'border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)]'
                  )}
                  onClick={() => updateSetting('theme', value)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Typography section (collapsible) */}
          <section className="border-b border-[var(--color-border-light)]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
              onClick={() => toggleSection('typography')}
            >
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">글꼴 설정</span>
              {!expandedSections.typography && (
                <span className="ml-auto mr-1 text-[13px] text-[var(--color-text-muted)]">
                  {FONT_FAMILIES[settings.fontFamily].name} · {settings.fontSize}px · {settings.lineHeight.toFixed(1)}
                </span>
              )}
              <ChevronIcon expanded={expandedSections.typography} />
            </button>

            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                expandedSections.typography ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="space-y-4 px-4 pb-4">
                {/* Font family grid */}
                <div>
                  <p className="mb-2 block text-xs font-medium text-[var(--color-text-tertiary)]">글꼴</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {fontFamilyList.map(({ key, name, css }) => (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-xl border-[1.5px] px-1.5 py-2.5 transition-all',
                          settings.fontFamily === key
                            ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-light)]'
                            : 'border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)]'
                        )}
                        onClick={() => updateSetting('fontFamily', key)}
                      >
                        <span className="text-[22px] leading-tight" style={{ fontFamily: css }}>가</span>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font size slider */}
                <div>
                  <p className="mb-2 block text-xs font-medium text-[var(--color-text-tertiary)]">크기</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">가</span>
                    <input
                      type="range"
                      min={12}
                      max={24}
                      step={1}
                      value={settings.fontSize}
                      onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                      className="reading-settings-slider flex-1"
                    />
                    <span className="text-lg text-[var(--color-text-muted)]">가</span>
                    <span className="min-w-[28px] text-right text-[13px] font-semibold text-[var(--color-accent-primary)]">
                      {settings.fontSize}
                    </span>
                  </div>
                </div>

                {/* Line height slider */}
                <div>
                  <p className="mb-2 block text-xs font-medium text-[var(--color-text-tertiary)]">줄간격</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">좁</span>
                    <input
                      type="range"
                      min={LINE_HEIGHT_MIN}
                      max={LINE_HEIGHT_MAX}
                      step={LINE_HEIGHT_STEP}
                      value={settings.lineHeight}
                      onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
                      className="reading-settings-slider flex-1"
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">넓</span>
                    <span className="min-w-[28px] text-right text-[13px] font-semibold text-[var(--color-accent-primary)]">
                      {settings.lineHeight.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Weight + Align chips */}
                <div className="flex flex-wrap gap-3">
                  <div>
                    <p className="mb-1.5 block text-[11px] text-[var(--color-text-muted)]">두께</p>
                    <div className="flex gap-1">
                      {WEIGHT_OPTIONS.map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'rounded-md border-[1.5px] px-2.5 py-1.5 text-xs font-medium transition-all',
                            settings.fontWeight === value
                              ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-white'
                              : 'border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)]'
                          )}
                          onClick={() => updateSetting('fontWeight', value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 block text-[11px] text-[var(--color-text-muted)]">정렬</p>
                    <div className="flex gap-1">
                      {ALIGN_OPTIONS.map(({ value, icon }) => (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'flex items-center justify-center rounded-md border-[1.5px] p-1.5 transition-all',
                            settings.textAlign === value
                              ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-white'
                              : 'border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)]'
                          )}
                          onClick={() => updateSetting('textAlign', value)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-3">
                  <p className="mb-1 text-[11px] font-medium text-[var(--color-text-muted)]">글꼴 미리보기</p>
                  <p
                    className="text-sm text-[var(--color-text-primary)]"
                    style={{
                      fontFamily: FONT_FAMILIES[settings.fontFamily].css,
                      fontWeight: FONT_WEIGHTS[settings.fontWeight],
                    }}
                  >
                    태초에 하나님이 천지를 창조하시니라
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Reading mode section (collapsible) */}
          <section className="border-b border-[var(--color-border-light)]">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
              onClick={() => toggleSection('readingMode')}
            >
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">읽기 모드</span>
              {!expandedSections.readingMode && (
                <span className="ml-auto mr-1 text-[13px] text-[var(--color-text-muted)]">
                  {settings.verseJoining ? '절 붙임' : '기본'}{settings.highlightNames ? ' · 강조' : ''}
                </span>
              )}
              <ChevronIcon expanded={expandedSections.readingMode} />
            </button>

            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                expandedSections.readingMode ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="space-y-1 px-4 pb-4">
                {/* Verse joining */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">절 붙임 (통독 모드)</p>
                    <p className="text-xs text-[var(--color-text-muted)]">절을 문단으로 연결하여 흐름있게 읽기</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.verseJoining}
                    onChange={(v) => updateSetting('verseJoining', v)}
                  />
                </div>

                {/* Highlight names */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">인명/지명 강조</p>
                    <p className="text-xs text-[var(--color-text-muted)]">성경 인물과 지명을 색상으로 구분</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.highlightNames}
                    onChange={(v) => updateSetting('highlightNames', v)}
                  />
                </div>

                {/* Verse numbers */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">절 번호 표시</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.showVerseNumbers}
                    onChange={(v) => updateSetting('showVerseNumbers', v)}
                  />
                </div>

                {/* Tongdok auto complete */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">통독 자동 완료</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.tongdokAutoComplete}
                    onChange={(v) => updateSetting('tongdokAutoComplete', v)}
                  />
                </div>

                {/* Show description */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">소제목 표시</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.showDescription}
                    onChange={(v) => updateSetting('showDescription', v)}
                    small
                  />
                </div>

                {/* Show cross ref */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">교차 참조</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.showCrossRef}
                    onChange={(v) => updateSetting('showCrossRef', v)}
                    small
                  />
                </div>

                {/* Show footnotes */}
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">각주 표시</p>
                  </div>
                  <ToggleSwitch
                    checked={settings.showFootnotes}
                    onChange={(v) => updateSetting('showFootnotes', v)}
                    small
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-2 border-t border-[var(--color-border-default)] px-4 py-3">
          <button
            type="button"
            className={cn(
              'rounded-xl border border-[var(--color-border-default)] px-4 py-2.5 text-sm font-medium transition-colors',
              'text-[var(--color-text-secondary)] hover:bg-[var(--color-button-default)]'
            )}
            onClick={() => {
              resetSettings()
            }}
          >
            초기화
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors',
              'bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)]'
            )}
            onClick={onClose}
          >
            완료
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
