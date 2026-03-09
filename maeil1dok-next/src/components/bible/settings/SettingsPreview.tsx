'use client'

import { FONT_FAMILIES, FONT_WEIGHTS } from '@/hooks/bible/ReadingSettingsContext'

interface SettingsPreviewProps {
  effectiveTheme: 'light' | 'dark'
  fontFamily: string
  fontSize: number
  fontWeight: string
  lineHeight: number
  textAlign: string
  verseJoining: boolean
  showVerseNumbers: boolean
}

export function SettingsPreview({
  effectiveTheme,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textAlign,
  verseJoining,
  showVerseNumbers,
}: SettingsPreviewProps) {
  return (
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
            fontFamily: FONT_FAMILIES[fontFamily as keyof typeof FONT_FAMILIES].css,
            fontSize: `${fontSize}px`,
            fontWeight: FONT_WEIGHTS[fontWeight as keyof typeof FONT_WEIGHTS],
            lineHeight: lineHeight,
            textAlign: textAlign as React.CSSProperties['textAlign'],
            color: effectiveTheme === 'dark' ? '#e0e0e0' : '#1f2937',
          }}
        >
          {verseJoining ? (
            <p className="m-0">
              {showVerseNumbers ? (
                <sup className="mr-0.5 text-[0.6em] opacity-50" style={{ fontFamily: 'sans-serif' }}>1</sup>
              ) : null}
              아브라함과 다윗의 자손 예수 그리스도의 계보라{' '}
              {showVerseNumbers ? (
                <sup className="mr-0.5 text-[0.6em] opacity-50" style={{ fontFamily: 'sans-serif' }}>2</sup>
              ) : null}
              아브라함이 이삭을 낳고 이삭은 야곱을 낳고
            </p>
          ) : (
            <>
              <p className="m-0 flex gap-1.5">
                {showVerseNumbers ? (
                  <span className="shrink-0 text-[0.7em] font-medium opacity-40" style={{ fontFamily: 'sans-serif', lineHeight: '2' }}>1</span>
                ) : null}
                <span>아브라함과 다윗의 자손 예수 그리스도의 계보라</span>
              </p>
              <p className="m-0 flex gap-1.5">
                {showVerseNumbers ? (
                  <span className="shrink-0 text-[0.7em] font-medium opacity-40" style={{ fontFamily: 'sans-serif', lineHeight: '2' }}>2</span>
                ) : null}
                <span>아브라함이 이삭을 낳고 이삭은 야곱을 낳고</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
