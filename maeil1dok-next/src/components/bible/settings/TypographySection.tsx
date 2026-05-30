'use client'

import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  type FontWeight,
  type TextAlign,
} from '@/hooks/bible/ReadingSettingsContext'
import { cn } from '@/lib/utils'

interface TypographySectionProps {
  settings: {
    fontFamily: string
    fontSize: number
    lineHeight: number
    fontWeight: string
    textAlign: string
  }
  fontFamilyList: Array<{ key: string; name: string; css: string }>
  expanded: boolean
  onToggle: () => void
  onUpdateSetting: (key: string, value: string | number) => void
}

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

export function TypographySection({
  settings,
  fontFamilyList,
  expanded,
  onToggle,
  onUpdateSetting,
}: TypographySectionProps) {
  return (
    <section className="border-b border-[var(--color-border-light)]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left"
        onClick={onToggle}
      >
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">글꼴 설정</span>
         {!expanded && (
           <span className="ml-auto mr-1 text-[13px] text-[var(--color-text-muted)]">
             {FONT_FAMILIES[settings.fontFamily as keyof typeof FONT_FAMILIES].name} · {settings.fontSize}px · {settings.lineHeight.toFixed(1)}
           </span>
         )}
        <ChevronIcon expanded={expanded} />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
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
                      ? 'border-[var(--color-ink)] bg-[var(--color-brand-faint)]'
                      : 'border-[var(--color-border-default)] hover:border-[var(--color-ink)]'
                  )}
                  onClick={() => onUpdateSetting('fontFamily', key as string)}
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
                onChange={(e) => onUpdateSetting('fontSize', Number(e.target.value))}
                className="reading-settings-slider flex-1"
              />
              <span className="text-lg text-[var(--color-text-muted)]">가</span>
              <span className="min-w-[28px] text-right text-[13px] font-semibold text-[var(--color-brand)]">
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
                onChange={(e) => onUpdateSetting('lineHeight', Number(e.target.value))}
                className="reading-settings-slider flex-1"
              />
              <span className="text-xs text-[var(--color-text-muted)]">넓</span>
              <span className="min-w-[28px] text-right text-[13px] font-semibold text-[var(--color-brand)]">
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
                        ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                        : 'border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-ink)]'
                    )}
                    onClick={() => onUpdateSetting('fontWeight', value)}
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
                        ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                        : 'border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-ink)]'
                    )}
                    onClick={() => onUpdateSetting('textAlign', value)}
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
                fontFamily: FONT_FAMILIES[settings.fontFamily as keyof typeof FONT_FAMILIES].css,
                fontWeight: FONT_WEIGHTS[settings.fontWeight as keyof typeof FONT_WEIGHTS],
              }}
            >
              태초에 하나님이 천지를 창조하시니라
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
