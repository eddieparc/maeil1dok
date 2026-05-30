'use client'

import { cn } from '@/lib/utils'

interface ReadingModeSectionProps {
  settings: {
    verseJoining: boolean
    highlightNames: boolean
    showVerseNumbers: boolean
    tongdokAutoComplete: boolean
    showDescription: boolean
    showCrossRef: boolean
    showFootnotes: boolean
  }
  expanded: boolean
  onToggle: () => void
  onUpdateSetting: (key: string, value: boolean) => void
}

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
        checked ? 'bg-[var(--color-ink)]' : 'bg-[var(--color-border-default)]'
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

export function ReadingModeSection({
  settings,
  expanded,
  onToggle,
  onUpdateSetting,
}: ReadingModeSectionProps) {
  return (
    <section className="border-b border-[var(--color-border-light)]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
        onClick={onToggle}
      >
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">읽기 모드</span>
        {!expanded && (
          <span className="ml-auto mr-1 text-[13px] text-[var(--color-text-muted)]">
            {settings.verseJoining ? '절 붙임' : '기본'}{settings.highlightNames ? ' · 강조' : ''}
          </span>
        )}
        <ChevronIcon expanded={expanded} />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
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
              onChange={(v) => onUpdateSetting('verseJoining', v)}
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
              onChange={(v) => onUpdateSetting('highlightNames', v)}
            />
          </div>

          {/* Verse numbers */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">절 번호 표시</p>
            </div>
            <ToggleSwitch
              checked={settings.showVerseNumbers}
              onChange={(v) => onUpdateSetting('showVerseNumbers', v)}
            />
          </div>

          {/* Tongdok auto complete */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">통독 자동 완료</p>
            </div>
            <ToggleSwitch
              checked={settings.tongdokAutoComplete}
              onChange={(v) => onUpdateSetting('tongdokAutoComplete', v)}
            />
          </div>

          {/* Show description */}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">소제목 표시</p>
            </div>
            <ToggleSwitch
              checked={settings.showDescription}
              onChange={(v) => onUpdateSetting('showDescription', v)}
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
              onChange={(v) => onUpdateSetting('showCrossRef', v)}
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
              onChange={(v) => onUpdateSetting('showFootnotes', v)}
              small
            />
          </div>
        </div>
      </div>
    </section>
  )
}
