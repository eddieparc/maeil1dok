'use client'

import { useContext } from 'react'
import {
  ReadingSettingsContext,
  type ReadingSettingsContextValue,
} from './ReadingSettingsContext'

/**
 * Access reading settings from the nearest ReadingSettingsProvider.
 * Must be used within a ReadingSettingsProvider.
 */
export function useReadingSettings(): ReadingSettingsContextValue {
  const ctx = useContext(ReadingSettingsContext)
  if (!ctx) {
    throw new Error(
      'useReadingSettings must be used within a ReadingSettingsProvider',
    )
  }
  return ctx
}
