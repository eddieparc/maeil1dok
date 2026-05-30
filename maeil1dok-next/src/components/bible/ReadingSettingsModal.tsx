'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import {
  FONT_FAMILY_ORDER,
  FONT_FAMILIES,
  type ThemeMode,
} from '@/hooks/bible/ReadingSettingsContext'
import { cn } from '@/lib/utils'
import { useScrollLock } from '@/hooks/useScrollLock'
import { SettingsPreview } from './settings/SettingsPreview'
import { TypographySection } from './settings/TypographySection'
import { ReadingModeSection } from './settings/ReadingModeSection'

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

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; Icon: () => React.ReactElement }> = [
  { value: 'light', label: '라이트', Icon: SunIcon },
  { value: 'dark', label: '다크', Icon: MoonIcon },
  { value: 'system', label: '자동', Icon: MonitorIcon },
]

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
          'relative z-10 mx-auto w-full max-w-lg flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl',
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

         <SettingsPreview
           effectiveTheme={effectiveTheme}
           fontFamily={settings.fontFamily}
           fontSize={settings.fontSize}
           fontWeight={settings.fontWeight}
           lineHeight={settings.lineHeight}
           textAlign={settings.textAlign}
           verseJoining={settings.verseJoining}
           showVerseNumbers={settings.showVerseNumbers}
         />

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
                      ? 'border-[var(--color-ink)] bg-[var(--color-brand-faint)] text-[var(--color-brand)]'
                      : 'border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-ink)]'
                  )}
                  onClick={() => updateSetting('theme', value)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>

           <TypographySection
             settings={{
               fontFamily: settings.fontFamily,
               fontSize: settings.fontSize,
               lineHeight: settings.lineHeight,
               fontWeight: settings.fontWeight,
               textAlign: settings.textAlign,
             }}
             fontFamilyList={fontFamilyList}
             expanded={expandedSections.typography}
             onToggle={() => toggleSection('typography')}
             onUpdateSetting={(key, value) => {
               if (key === 'fontSize' || key === 'lineHeight') {
                 updateSetting(key as 'fontSize' | 'lineHeight', value as number)
               } else {
                 updateSetting(key as any, value as any)
               }
             }}
           />

           <ReadingModeSection
             settings={{
               verseJoining: settings.verseJoining,
               highlightNames: settings.highlightNames,
               showVerseNumbers: settings.showVerseNumbers,
               tongdokAutoComplete: settings.tongdokAutoComplete,
               showDescription: settings.showDescription,
               showCrossRef: settings.showCrossRef,
               showFootnotes: settings.showFootnotes,
             }}
             expanded={expandedSections.readingMode}
             onToggle={() => toggleSection('readingMode')}
             onUpdateSetting={(key, value) => updateSetting(key as keyof typeof settings, value as boolean)}
           />
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
              'bg-[var(--color-ink)] hover:bg-[var(--color-brand-deep)]'
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
