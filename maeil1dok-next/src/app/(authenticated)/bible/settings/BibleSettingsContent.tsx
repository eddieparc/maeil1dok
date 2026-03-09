'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReadingSettingsProvider,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type ThemeMode,
} from '@/hooks/bible/ReadingSettingsContext'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import { useModal } from '@/hooks/useModal'
import { createClient } from '@/lib/supabase/client'
import { ToggleItem, DangerButton } from './SettingsControls'
import { FontSection } from './FontSection'

function BibleSettingsInner() {
  const { settings, updateSetting, resetSettings, isSyncing } = useReadingSettings()
  const modal = useModal()
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
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
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  const confirmAction = useCallback(
    async (title: string, description: string): Promise<boolean> => {
      return modal.confirm({ title, description, confirmVariant: 'danger', icon: 'warning' })
    },
    [modal],
  )

  const previewStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILIES[settings.fontFamily].css,
    fontSize: settings.fontSize + 'px',
    fontWeight: FONT_WEIGHTS[settings.fontWeight],
    lineHeight: settings.lineHeight,
    textAlign: settings.textAlign,
  }

  const themeOptions: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: '라이트', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg> },
    { value: 'dark', label: '다크', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
    { value: 'system', label: '자동', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg> },
  ]

  async function deleteAllBookmarks() {
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

  async function deleteAllNotes() {
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

  async function deleteAllHighlights() {
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

  async function handleResetAllSettings() {
    const confirmed = await confirmAction('설정 초기화', '모든 설정을 기본값으로 초기화하시겠습니까?')
    if (!confirmed) return
    resetSettings()
    showToast('설정이 초기화되었습니다')
  }

  return (
    <>
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

      <FontSection settings={settings} updateSetting={updateSetting} />

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

      {/* Toast */}
      {toast ? (
        <div className={[
          'fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg',
          toast.type === 'error' ? 'bg-red-500' : toast.type === 'info' ? 'bg-blue-500' : 'bg-[var(--color-accent-primary,#7c6a5a)]',
        ].join(' ')}>
          {toast.message}
        </div>
      ) : null}

      {/* Slider CSS */}
      <style>{`
        .slider { flex: 1; height: 4px; -webkit-appearance: none; appearance: none; background-color: var(--color-border-default, #e5e0d8); border-radius: 2px; outline: none; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background-color: var(--color-accent-primary, #7c6a5a); cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background-color: var(--color-accent-primary, #7c6a5a); cursor: pointer; border: none; }
      `}</style>

      {isSyncing ? <span className="sr-only">저장 중...</span> : null}
    </>
  )
}

export function BibleSettingsContent() {
  return (
    <ReadingSettingsProvider>
      <BibleSettingsInner />
    </ReadingSettingsProvider>
  )
}
