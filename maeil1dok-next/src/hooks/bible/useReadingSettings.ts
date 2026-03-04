'use client'

import { useContext, useEffect, useMemo } from 'react'
import {
  ReadingSettingsContext,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type ReadingSettings,
  type ReadingSettingsContextValue,
} from './ReadingSettingsContext'

export interface UseReadingSettingsOptions {
  onSettingsChange?: (settings: ReadingSettings) => void
}

export interface ReadingSettingsStyleVars {
  '--reading-font-family': string
  '--reading-font-size': string
  '--reading-font-weight': string
  '--reading-line-height': string
  '--reading-text-align': ReadingSettings['textAlign']
}

export interface UseReadingSettingsValue extends ReadingSettingsContextValue {
  cssVariables: ReadingSettingsStyleVars
}

/**
 * Access reading settings from the nearest ReadingSettingsProvider.
 * Must be used within a ReadingSettingsProvider.
 */
export function useReadingSettings(
  options?: UseReadingSettingsOptions,
): UseReadingSettingsValue {
  const ctx = useContext(ReadingSettingsContext)
  const onSettingsChange = options?.onSettingsChange

  if (!ctx) {
    throw new Error(
      'useReadingSettings must be used within a ReadingSettingsProvider',
    )
  }

  useEffect(() => {
    if (!onSettingsChange) {
      return
    }

    onSettingsChange(ctx.settings)
  }, [ctx.settings, onSettingsChange])

  const cssVariables = useMemo<ReadingSettingsStyleVars>(
    () => ({
      '--reading-font-family': FONT_FAMILIES[ctx.settings.fontFamily].css,
      '--reading-font-size': `${ctx.settings.fontSize}px`,
      '--reading-font-weight': String(FONT_WEIGHTS[ctx.settings.fontWeight]),
      '--reading-line-height': String(ctx.settings.lineHeight),
      '--reading-text-align': ctx.settings.textAlign,
    }),
    [ctx.settings],
  )

  return {
    ...ctx,
    cssVariables,
  }
}
