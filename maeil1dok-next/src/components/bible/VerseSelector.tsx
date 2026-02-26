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

  return {
    selectedVerseRange,
    onVerseClick,
    clearSelection,
  }
}
