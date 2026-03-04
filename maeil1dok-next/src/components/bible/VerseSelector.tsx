'use client'

import { useState } from 'react'

export interface VerseRange {
  start: number
  end: number
}

export function useVerseSelection() {
  const [selectedVerseRange, setSelectedVerseRange] = useState<VerseRange | null>(null)

  const onVerseClick = (verseNumber: number) => {
    setSelectedVerseRange({ start: verseNumber, end: verseNumber })
  }

  const clearSelection = () => {
    setSelectedVerseRange(null)
  }

  const onVerseRangeSelect = (start: number, end: number) => {
    const min = Math.min(start, end)
    const max = Math.max(start, end)
    setSelectedVerseRange({ start: min, end: max })
  }

  return {
    selectedVerseRange,
    onVerseClick,
    onVerseRangeSelect,
    clearSelection,
  }
}
