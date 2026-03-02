'use client'

import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import { FONT_FAMILIES, type FontFamily, type ThemeMode, type TextAlign } from '@/hooks/bible/ReadingSettingsContext'

interface ReadingSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReadingSettingsModal({ isOpen, onClose }: ReadingSettingsModalProps) {
  const { settings, updateSetting } = useReadingSettings()

  if (!isOpen) return null

  const fontFamilyList = Object.entries(FONT_FAMILIES) as [FontFamily, { name: string; css: string; type: string }][]

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-4">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">읽기 설정</h3>
          <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" onClick={onClose} aria-label="닫기">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          {/* 테마 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">테마</p>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                    settings.theme === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => updateSetting('theme', t)}
                >
                  {t === 'light' ? '밝음' : t === 'dark' ? '어둠' : '시스템'}
                </button>
              ))}
            </div>
          </section>

          {/* 폰트 패밀리 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">글꼴</p>
            <div className="flex flex-col gap-1.5">
              {fontFamilyList.map(([key, font]) => (
                <button
                  key={key}
                  type="button"
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
                    settings.fontFamily === key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => updateSetting('fontFamily', key)}
                >
                  <span style={{ fontFamily: font.css }}>{font.name}</span>
                  {settings.fontFamily === key ? (
                    <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {/* 폰트 크기 */}
          <section>
            <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400">
              글자 크기 <span className="text-sm text-gray-600">{settings.fontSize}px</span>
            </p>
            <input
              type="range"
              min={12}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </section>

          {/* 줄간격 */}
          <section>
            <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400">
              줄 간격 <span className="text-sm text-gray-600">{settings.lineHeight}</span>
            </p>
            <input
              type="range"
              min={1.2}
              max={2.4}
              step={0.1}
              value={settings.lineHeight}
              onChange={(e) => updateSetting('lineHeight', Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </section>

          {/* 텍스트 정렬 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">텍스트 정렬</p>
            <div className="flex gap-2">
              {(['left', 'justify'] as TextAlign[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${
                    settings.textAlign === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => updateSetting('textAlign', a)}
                >
                  {a === 'left' ? '왼쪽' : '양쪽'}
                </button>
              ))}
            </div>
          </section>

          {/* 표시 옵션 */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">표시 옵션</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { key: 'showVerseNumbers', label: '절 번호 표시' },
                  { key: 'showDescription', label: '소제목 표시' },
                  { key: 'showCrossRef', label: '교차 참조 표시' },
                  { key: 'showFootnotes', label: '각주 표시' },
                  { key: 'verseJoining', label: '절 이어쓰기' },
                  { key: 'tongdokAutoComplete', label: '통독 자동 완료' },
                ] as { key: keyof typeof settings; label: string }[]
              ).map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                  <span className="text-sm text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-blue-600"
                    checked={settings[key] as boolean}
                    onChange={(e) => updateSetting(key, e.target.checked as never)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
