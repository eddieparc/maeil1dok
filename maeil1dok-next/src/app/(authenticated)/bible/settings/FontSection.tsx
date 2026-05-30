'use client'

import {
  FONT_FAMILIES,
  FONT_FAMILY_ORDER,
  FONT_WEIGHTS,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  type FontWeight,
  type TextAlign,
  type ReadingSettings,
} from '@/hooks/bible/ReadingSettingsContext'

interface FontSectionProps {
  settings: ReadingSettings
  updateSetting: <K extends keyof ReadingSettings>(key: K, value: ReadingSettings[K]) => void
}

export function FontSection({ settings, updateSetting }: FontSectionProps) {
  const fontWeightOptions: Array<{ value: FontWeight; label: string }> = [
    { value: 'normal', label: '보통' },
    { value: 'medium', label: '중간' },
    { value: 'bold', label: '굵게' },
  ]

  const textAlignOptions: Array<{ value: TextAlign; label: string }> = [
    { value: 'left', label: '왼쪽' },
    { value: 'justify', label: '양쪽' },
  ]

  return (
    <section className="rounded-xl bg-[var(--color-bg-card,#fff)] p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary,#111)]">글꼴</h2>
      <div className="-mx-4 mb-4">
         <div className="flex gap-2 overflow-x-auto px-4 py-1" style={{ scrollbarWidth: 'none' }}>
           {FONT_FAMILY_ORDER.map((key) => (
             <button
               key={key}
               type="button"
               onClick={() => updateSetting('fontFamily', key)}
               style={{ fontFamily: FONT_FAMILIES[key].css }}
               className={[
                 'shrink-0 whitespace-nowrap rounded-[10px] border-[1.5px] px-4 py-2.5 text-[0.9375rem] transition-all',
                 settings.fontFamily === key
                   ? 'border-[var(--color-accent-primary,#4B9F7E)] bg-[var(--color-accent-light,#e9f5f0)] text-[var(--color-accent-primary,#4B9F7E)]'
                   : 'border-[var(--color-border-default,#e5e7eb)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#4B9F7E)]',
               ].join(' ')}
             >
              {FONT_FAMILIES[key].name}
            </button>
          ))}
        </div>
      </div>
       <div className="mb-4 flex flex-col gap-3 rounded-[10px] bg-[var(--color-bg-secondary,#f5f3f0)] p-3">
        <div className="flex items-center gap-3">
          <span className="min-w-[48px] text-[0.8125rem] font-medium text-[var(--color-text-secondary,#6b7280)]">크기</span>
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted,#9ca3af)]">가</span>
            <input type="range" min={14} max={24} step={1} value={settings.fontSize} onChange={(e) => updateSetting('fontSize', Number(e.target.value))} className="slider flex-1" />
            <span className="text-lg text-[var(--color-text-muted,#9ca3af)]">가</span>
            <span className="min-w-[28px] text-right text-[0.8125rem] font-semibold text-[var(--color-accent-primary,#4B9F7E)]">{settings.fontSize}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-[48px] text-[0.8125rem] font-medium text-[var(--color-text-secondary,#6b7280)]">줄간격</span>
          <div className="flex flex-1 items-center gap-2">
            <span className="whitespace-nowrap text-[0.6875rem] text-[var(--color-text-muted,#9ca3af)]">좁게</span>
            <input type="range" min={LINE_HEIGHT_MIN} max={LINE_HEIGHT_MAX} step={LINE_HEIGHT_STEP} value={settings.lineHeight} onChange={(e) => updateSetting('lineHeight', Number(e.target.value))} className="slider flex-1" />
            <span className="whitespace-nowrap text-[0.6875rem] text-[var(--color-text-muted,#9ca3af)]">넓게</span>
            <span className="min-w-[28px] text-right text-[0.8125rem] font-semibold text-[var(--color-accent-primary,#4B9F7E)]">{settings.lineHeight.toFixed(1)}</span>
          </div>
        </div>
      </div>
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
                     ? 'border-[var(--color-accent-primary,#4B9F7E)] bg-[var(--color-accent-primary,#4B9F7E)] text-white'
                     : 'border-[var(--color-border-default,#e5e7eb)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#4B9F7E)]',
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
                     ? 'border-[var(--color-accent-primary,#4B9F7E)] bg-[var(--color-accent-primary,#4B9F7E)] text-white'
                     : 'border-[var(--color-border-default,#e5e7eb)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-primary,#111)] hover:border-[var(--color-accent-primary,#4B9F7E)]',
                 ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
