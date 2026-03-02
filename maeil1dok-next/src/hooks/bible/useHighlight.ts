import { useCallback, useEffect, useRef, useState } from 'react'
import type { HighlightColor, VerseHighlight } from '@/types'

/**
 * Highlight with optional memo support.
 * Extends VerseHighlight from the existing types.
 */
export interface Highlight extends VerseHighlight {
  memo?: string
}

const CUSTOM_COLORS_KEY = 'highlightCustomColors'
const MAX_CUSTOM_COLORS = 5

function readCustomColors(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]')
  } catch {
    return []
  }
}

/**
 * Hook for managing Bible verse highlights with optimistic updates.
 *
 * Extracted from BibleViewer.tsx highlight logic, enhanced with:
 * - customColors: MRU list of recently-used colors (localStorage, max 5)
 * - memo: optional memo text on highlights
 * - optimistic updates for create/delete
 *
 * @param book - Bible book identifier (e.g., 'gen', 'mat')
 * @param chapter - Chapter number
 * @param version - Bible version (defaults to 'GAE')
 */
export function useHighlight(book: string, chapter: number, version: string = 'GAE') {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [customColors, setCustomColors] = useState<string[]>(readCustomColors)

  // Ref to avoid stale closures in callbacks
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights

  // ─── Load highlights ────────────────────────────────────────────────

  const loadHighlights = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        book,
        chapter: String(chapter),
        version,
      })

      const response = await fetch(`/api/bible/highlights?${params.toString()}`, { signal })
      if (!response.ok) {
        setHighlights([])
        return
      }

      const data = (await response.json()) as Highlight[]
      setHighlights(data)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setHighlights([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [book, chapter, version])

  useEffect(() => {
    const controller = new AbortController()
    void loadHighlights(controller.signal)
    return () => controller.abort()
  }, [loadHighlights])

  // ─── Custom color tracking ──────────────────────────────────────────

  const trackColor = useCallback((color: string) => {
    setCustomColors(prev => {
      const filtered = prev.filter(c => c !== color)
      const updated = [color, ...filtered].slice(0, MAX_CUSTOM_COLORS)
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(updated))
      }
      return updated
    })
  }, [])

  // ─── Create highlight (optimistic) ──────────────────────────────────

  const createHighlight = useCallback(async (verse: number, color: string, memo?: string): Promise<void> => {
    trackColor(color)

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Highlight = {
      id: optimisticId,
      userId: '',
      book,
      chapter,
      verseStart: verse,
      verseEnd: verse,
      color: color as HighlightColor,
      version,
      memo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Replace any existing highlight on this verse, add optimistic
    setHighlights(prev => [
      ...prev.filter(h => !(h.verseStart <= verse && h.verseEnd >= verse)),
      optimistic,
    ])

    try {
      const response = await fetch('/api/bible/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book,
          chapter,
          verseStart: verse,
          verseEnd: verse,
          color,
          version,
          memo,
        }),
      })

      if (!response.ok) {
        await loadHighlights()
        return
      }

      const saved = (await response.json()) as Highlight
      setHighlights(prev => [
        ...prev.filter(h => h.id !== optimisticId && h.id !== saved.id),
        saved,
      ])
    } catch {
      await loadHighlights()
    }
  }, [book, chapter, version, loadHighlights, trackColor])

  // ─── Update highlight ───────────────────────────────────────────────

  const updateHighlight = useCallback(async (id: string, color: string, memo?: string): Promise<void> => {
    trackColor(color)

    // Optimistic update
    setHighlights(prev =>
      prev.map(h =>
        h.id === id
          ? { ...h, color: color as HighlightColor, memo, updatedAt: new Date().toISOString() }
          : h
      )
    )

    try {
      const response = await fetch('/api/bible/highlights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, color, memo }),
      })

      if (!response.ok) {
        await loadHighlights()
      }
    } catch {
      await loadHighlights()
    }
  }, [loadHighlights, trackColor])

  // ─── Delete highlight (optimistic) ──────────────────────────────────

  const deleteHighlight = useCallback(async (id: string): Promise<void> => {
    const removed = highlightsRef.current.find(h => h.id === id)
    setHighlights(prev => prev.filter(h => h.id !== id))

    try {
      const params = new URLSearchParams({ id })
      const response = await fetch(`/api/bible/highlights?${params.toString()}`, {
        method: 'DELETE',
      })

      if (!response.ok && removed) {
        setHighlights(prev => [...prev, removed])
      }
    } catch {
      if (removed) {
        setHighlights(prev => [...prev, removed])
      }
    }
  }, [])

  // ─── Get verse highlight ────────────────────────────────────────────

  const getVerseHighlight = useCallback((verse: number): Highlight | null => {
    return highlightsRef.current.find(
      h => verse >= h.verseStart && verse <= h.verseEnd
    ) ?? null
  }, [])

  return {
    highlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getVerseHighlight,
    customColors,
    isLoading,
  }
}
