'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ReadingSettingsProvider,
  FONT_FAMILIES,
  FONT_FAMILY_ORDER,
  FONT_WEIGHTS,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  type ThemeMode,
  type FontWeight,
  type TextAlign,
} from '@/hooks/bible/ReadingSettingsContext'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import { createClient } from '@/lib/supabase/client'

// ── Inner component (must be inside ReadingSettingsProvider) ──────────

function BibleSettingsContent() {
  const { settings, updateSetting, resetSettings, isSyncing } =
    useReadingSettings()

  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type })
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(null), 3000)
    },
    [],
  )

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const confirmAction = useCallback(
    async (title: string, description: string): Promise<boolean> => {
      return window.confirm(title + '\n\n' + description)
    },
    [],
  )

  const previewStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILIES[settings.fontFamily].css,
    fontSize: settings.fontSize + 'px',
    fontWeight: FONT_WEIGHTS[settings.fontWeight],
    lineHeight: settings.lineHeight,
    textAlign: settings.textAlign,
  }

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
    {
      value: 'light',
      label: '라이트',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: '다크',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: '자동',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
  ]

  const fontWeightOptions: Array<{ value: FontWeight; label: string }> = [
    { value: 'normal', label: '보통' },
    { value: 'medium', label: '중간' },
    { value: 'bold', label: '굵게' },
  ]

  const textAlignOptions: Array<{ value: TextAlign; label: string }> = [
    { value: 'left', label: '왼쪽' },
    { value: 'justify', label: '양쪽' },
  ]

  const deleteAllBookmarks = async () => {
    const confirmed = await confirmAction('북마크 전체 삭제', '모든 북마크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')
    if (!confirmed) return
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('로그인이 필요합니다', 'error'); return }
      const { error } = await supabase.from('bible_bookmarks').delete().eq('user_id', user.id)
      if (error) throw error
      showToast('북마크가 모두 삭제되었습니다')
    } catch { showToast('북마크 삭제에 실패했습니다', 'error') }
    finally { setIsDeleting(false) }
  }

  const deleteAllNotes = async () => {
    const confirmed = await confirmAction('노트 전체 삭제', '모든 노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')
    if (!confirmed) return
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('로그인이 필요합니다', 'error'); return }
      const { error } = await supabase.from('bible_notes').delete().eq('user_id', user.id)
      if (error) throw error
      showToast('노트가 모두 삭제되었습니다')
    } catch { showToast('노트 삭제에 실패했습니다', 'error') }
    finally { setIsDeleting(false) }
  }

  const deleteAllHighlights = async () => {
    const confirmed = await confirmAction('하이라이트 전체 삭제', '모든 하이라이트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')
    if (!confirmed) return
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('로그인이 필요합니다', 'error'); return }
      const { error } = await supabase.from('bible_highlights').delete().eq('user_id', user.id)
      if (error) throw error
      showToast('하이라이트가 모두 삭제되었습니다')
    } catch { showToast('하이라이트 삭제에 실패했습니다', 'error') }
    finally { setIsDeleting(false) }
  }

  const handleResetAllSettings = async () => {
    const confirmed = await confirmAction('설정 초기화', '모든 설정을 기본값으로 초기화하시겠습니까?')
    if (!confirmed) return
    resetSettings()
    showToast('설정이 초기화되었습니다')
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary,#faf8f6)]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] px-4 py-3">
        <Link
          href="/bible"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary,#6b7280)] transition-colors hover:bg-[var(--color-bg-hover,#f3f4f6)] hover:text-[var(--color-text-primary,#111)]"
          aria-label="뒤로 가기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-semibold text-[var(--color-text-primary,#111)]">읽기 설정</h1>
        {isSyncing && (
          <span className="text-xs text-[var(--color-text-muted,#9ca3af)]">저장 중…</span>
        )}
      </header>

      {/* Content */}
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 pb-8">

        {/* Preview */}
        <section className="overflow-hidden rounded-xl bg-[var(--color-bg-card,#fff)] shadow-sm">
          <div className="border-b border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-secondary,#f9f7f4)] px-4 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted,#9ca3af)]">미리보기</span>
          </div>
          <div className="min-h-[80px] p-4 text-[var(--color-text-primary,#111)]" style={previewStyle}>
            {settings.verseJoining ? (
              <p className="m-0">
                <sup className="mr-0.5 font-sans text-[0.6em] text-[var(--color-text-muted,#9ca3af)]" style={{ verticalAlign: 'super' }}>1</sup>
                태초에 하나님이 천지를 창조하시니라{' '}
                <sup className="mr-0.5 font-sans text-[0.6em] text-[var(--color-text-muted,#9ca3af)]" style={{ verticalAlign: 'super' }}>2</sup>
                땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라
              </p>
            ) : (
              <>
                <div className="mb-2 flex gap-2">
                  {settings.showVerseNumbers && (
                    <span className="min-w-[1.25em] shrink-0 text-right font-sans text-[0.7em] font-medium leading-loose text-[var(--color-text-muted,#9ca3af)]">1</span>
                  )}
                  <span className="flex-1">태초에 하나님이 천지를 창조하시니라</span>
                </div>
                <div className="flex gap-2">
                  {settings.showVerseNumbers && (
                    <span className="min-w-[1.25em] shrink-0 text-right font-sans text-[0.7em] font-medium leading-loose text-[var(--color-text-muted,#9ca3af)]">2</span>
                  )}
                  <span className="flex-1">땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Theme */}
        <section className="rounded-xl bg-[var(--color-bg-card,#fff)] p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary,#111)]">테마</h2>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateSetting('theme', opt.value)}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3 py-3 text-sm font-medium transition-all',
                  settings.theme === opt.value
                    ? 'border-[var(--color-accent-primary,#7c6a5a)] bg-[var(--color-accent-primary-light,#f5f0eb)] text-[var(--color-accent-primary,#7c6a5a)]'
                    : 'border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#7c6a5a)]',
                ].join(' ')}
              >
                <span className="flex items-center">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Font */}
        <section className="rounded-xl bg-[var(--color-bg-card,#fff)] p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary,#111)]">글꼴</h2>

          {/* Font family scroll */}
          <div className="-mx-4 mb-4">
            <div className="flex gap-2 overflow-x-auto px-4 py-1" style={{ scrollbarWidth: 'none' }}>
              {FONT_FAMILY_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateSetting('fontFamily', key)}
                  style={{ fontFamily: FONT_FAMILIES[key].css }}
                  className={[
                    'shrink-0 whitespace-nowrap rounded-xl border-[1.5px] px-4 py-2.5 text-[0.9375rem] transition-all',
                    settings.fontFamily === key
                      ? 'border-[var(--color-accent-primary,#7c6a5a)] bg-[var(--color-accent-primary-light,#f5f0eb)] text-[var(--color-accent-primary,#7c6a5a)]'
                      : 'border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#7c6a5a)]',
                  ].join(' ')}
                >
                  {FONT_FAMILIES[key].name}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="mb-4 flex flex-col gap-3 rounded-xl bg-[var(--color-bg-secondary,#f9f7f4)] p-3">
            <div className="flex items-center gap-3">
              <span className="min-w-[48px] text-[0.8125rem] font-medium text-[var(--color-text-secondary,#6b7280)]">크기</span>
              <div className="flex flex-1 items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted,#9ca3af)]">가</span>
                <input
                  type="range" min={14} max={24} step={1}
                  value={settings.fontSize}
                  onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                  className="slider flex-1"
                />
                <span className="text-lg text-[var(--color-text-muted,#9ca3af)]">가</span>
                <span className="min-w-[28px] text-right text-[0.8125rem] font-semibold text-[var(--color-accent-primary,#7c6a5a)]">{settings.fontSize}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-[48px] text-[0.8125rem] font-medium text-[var(--color-text-secondary,#6b7280)]">줄간격</span>
              <div className="flex flex-1 items-center gap-2">
                <span className="whitespace-nowrap text-[0.6875rem] text-[var(--color-text-muted,#9ca3af)]">좁게</span>
                <input
                  type="range" min={LINE_HEIGHT_MIN} max={LINE_HEIGHT_MAX} step={LINE_HEIGHT_STEP}
                  value={settings.lineHeight}
                  onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
                  className="slider flex-1"
                />
                <span className="whitespace-nowrap text-[0.6875rem] text-[var(--color-text-muted,#9ca3af)]">넓게</span>
                <span className="min-w-[28px] text-right text-[0.8125rem] font-semibold text-[var(--color-accent-primary,#7c6a5a)]">{settings.lineHeight.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Weight & align */}
          <div className="flex gap-4">
            <div className="flex-1">
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary,#6b7280)]">두께</span>
              <div className="flex gap-1">
                {fontWeightOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSetting('fontWeight', opt.value)}
                    style={{ fontFamily: FONT_FAMILIES[settings.fontFamily].css, fontWeight: FONT_WEIGHTS[opt.value] }}
                    className={[
                      'flex flex-1 items-center justify-center rounded-md border-[1.5px] py-1.5 text-[0.9375rem] transition-all',
                      settings.fontWeight === opt.value
                        ? 'border-[var(--color-accent-primary,#7c6a5a)] bg-[var(--color-accent-primary,#7c6a5a)] text-white'
                        : 'border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#7c6a5a)]',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary,#6b7280)]">정렬</span>
              <div className="flex gap-1">
                {textAlignOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSetting('textAlign', opt.value)}
                    className={[
                      'flex flex-1 items-center justify-center rounded-md border-[1.5px] py-2 text-[0.8125rem] font-medium transition-all',
                      settings.textAlign === opt.value
                        ? 'border-[var(--color-accent-primary,#7c6a5a)] bg-[var(--color-accent-primary,#7c6a5a)] text-white'
                        : 'border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#7c6a5a)]',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Reading options */}
        <section className="rounded-xl bg-[var(--color-bg-card,#fff)] p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary,#111)]">읽기 옵션</h2>
          <ToggleItem title="절 번호 표시" checked={settings.showVerseNumbers} onChange={(v) => updateSetting('showVerseNumbers', v)} />
          <ToggleItem title="절 붙임 (통독 모드)" description="절을 문단으로 연결하여 흐름있게 읽기" checked={settings.verseJoining} onChange={(v) => updateSetting('verseJoining', v)} />
          <ToggleItem title="인명/지명 강조" description="성경 인물과 지명을 색상으로 구분" checked={settings.highlightNames} onChange={(v) => updateSetting('highlightNames', v)} isLast />
        </section>

        {/* Tongdok settings */}
        <section className="rounded-xl bg-[var(--color-bg-card,#fff)] p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary,#111)]">통독 설정</h2>
          <ToggleItem title="통독모드 자동 완료" description="마지막 장을 넘길 때 자동으로 완료 처리" checked={settings.tongdokAutoComplete} onChange={(v) => updateSetting('tongdokAutoComplete', v)} isLast />
        </section>

        {/* Data management */}
        <section className="rounded-xl border border-[var(--color-error-bg,#fee2e2)] bg-[var(--color-bg-card,#fff)] p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[var(--color-error,#ef4444)]">데이터 관리</h2>
          <p className="mb-3 text-xs text-[var(--color-error,#ef4444)]">아래 작업은 되돌릴 수 없습니다.</p>
          <div className="flex flex-col gap-2">
            <DangerButton label="북마크 전체 삭제" disabled={isDeleting} onClick={() => void deleteAllBookmarks()} />
            <DangerButton label="노트 전체 삭제" disabled={isDeleting} onClick={() => void deleteAllNotes()} />
            <DangerButton label="하이라이트 전체 삭제" disabled={isDeleting} onClick={() => void deleteAllHighlights()} />
            <DangerButton label="모든 설정 초기화" disabled={isDeleting} variant="reset" onClick={() => void handleResetAllSettings()} />
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          'fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg',
          toast.type === 'error' ? 'bg-red-500' : toast.type === 'info' ? 'bg-blue-500' : 'bg-[var(--color-accent-primary,#7c6a5a)]',
        ].join(' ')}>
          {toast.message}
        </div>
      )}

      {/* Slider CSS */}
      <style>{`
        .slider { flex: 1; height: 4px; -webkit-appearance: none; appearance: none; background-color: var(--color-border-default, #e5e0d8); border-radius: 2px; outline: none; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background-color: var(--color-accent-primary, #7c6a5a); cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background-color: var(--color-accent-primary, #7c6a5a); cursor: pointer; border: none; }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

interface ToggleItemProps {
  title: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  isLast?: boolean
}

function ToggleItem({ title, description, checked, onChange, isLast = false }: ToggleItemProps) {
  return (
    <div className={['flex items-center justify-between py-2.5', !isLast ? 'border-b border-[var(--color-border-light,#f0ece6)]' : ''].join(' ')}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.9375rem] font-medium text-[var(--color-text-primary,#111)]">{title}</span>
        {description && <span className="text-xs text-[var(--color-text-muted,#9ca3af)]">{description}</span>}
      </div>
      <label className="relative inline-block h-[26px] w-[44px] shrink-0">
        <input type="checkbox" className="h-0 w-0 opacity-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={['absolute inset-0 cursor-pointer rounded-full transition-colors duration-200', checked ? 'bg-[var(--color-accent-primary,#7c6a5a)]' : 'bg-[var(--color-border-default,#e5e0d8)]'].join(' ')}>
          <span className={['absolute bottom-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0'].join(' ')} />
        </span>
      </label>
    </div>
  )
}

interface DangerButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  variant?: 'default' | 'reset'
}

function DangerButton({ label, disabled, onClick, variant = 'default' }: DangerButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'reset'
          ? 'border-[var(--color-error,#ef4444)] text-[var(--color-error,#ef4444)] hover:bg-[var(--color-error,#ef4444)] hover:text-white'
          : 'border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-secondary,#6b7280)] hover:border-[var(--color-error,#ef4444)] hover:bg-[var(--color-error-bg,#fee2e2)] hover:text-[var(--color-error,#ef4444)]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ── Page export ───────────────────────────────────────────────────────

export default function BibleSettingsPage() {
  return (
    <ReadingSettingsProvider>
      <BibleSettingsContent />
    </ReadingSettingsProvider>
  )
}
