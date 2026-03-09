'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { VerseRange } from './VerseSelector'
import type { VerseHighlight } from '@/types'
import type { UserReadingSettings } from '@/types/profile'
import { buildInteractiveSrcDoc } from './chapter/buildInteractiveSrcDoc'
import ChapterSkeleton from './chapter/ChapterSkeleton'
import ChapterError from './chapter/ChapterError'

interface BibleChapterViewProps {
  book: string
  chapter: number
  version: string
  content: string
  isLoading: boolean
  error?: string | null
  onRetry?: () => void
  onVerseTap?: (payload: {
    interaction: 'tap' | 'selection'
    text: string
    verseNumber?: number
    startVerse?: number
    endVerse?: number
    position?: { x: number; y: number }
  }) => void
  highlights?: VerseHighlight[]
  onHighlightsLoaded?: (highlights: VerseHighlight[]) => void
  readingSettings?: UserReadingSettings | null
  selectedVerseRange?: VerseRange | null
}

export default function BibleChapterView({
  book,
  chapter,
  version,
  content,
  isLoading,
  error,
  onRetry,
  onVerseTap,
  highlights = [],
  onHighlightsLoaded,
  readingSettings,
  selectedVerseRange,
}: BibleChapterViewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const interactiveContent = useMemo(() => buildInteractiveSrcDoc(content), [content])

  const syncHighlightsToIframe = useCallback(() => {
    const frame = iframeRef.current?.contentWindow
    if (!frame) {
      return
    }

    frame.postMessage(
      {
        type: 'bible-highlights-sync',
        highlights: highlights.map((highlight) => ({
          id: highlight.id,
          verseStart: highlight.verseStart,
          verseEnd: highlight.verseEnd,
          color: highlight.color,
        })),
      },
      '*'
    )
  }, [highlights])

  const syncReadingSettingsToIframe = useCallback(() => {
    const frame = iframeRef.current?.contentWindow
    if (!frame || !readingSettings) {
      return
    }

    frame.postMessage(
      {
        type: 'bible-reading-settings',
        settings: {
          theme: readingSettings.theme,
          fontFamily: readingSettings.fontFamily,
          fontSize: readingSettings.fontSize,
          lineHeight: readingSettings.lineHeight,
          fontWeight: readingSettings.fontWeight,
          textAlign: readingSettings.textAlign,
          showVerseNumbers: readingSettings.showVerseNumbers,
          verseJoining: readingSettings.verseJoining,
          showDescription: readingSettings.showDescription,
          showCrossRef: readingSettings.showCrossRef,
          highlightNames: readingSettings.highlightNames,
          showFootnotes: readingSettings.showFootnotes,
        },
      },
      '*'
    )
  }, [readingSettings])

  const syncSelectionToIframe = useCallback(() => {
    const frame = iframeRef.current?.contentWindow
    if (!frame) {
      return
    }

    frame.postMessage(
      {
        type: 'bible-selection-sync',
        selection: selectedVerseRange,
      },
      '*'
    )
  }, [selectedVerseRange])

  useEffect(() => {
    if (!onHighlightsLoaded) {
      return
    }

    const handleHighlightsLoaded = onHighlightsLoaded
    const controller = new AbortController()

    async function fetchHighlights() {
      try {
        const params = new URLSearchParams({
          book,
          chapter: String(chapter),
          version,
        })

        const response = await fetch(`/api/bible/highlights?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          handleHighlightsLoaded([])
          return
        }

        const data = (await response.json()) as VerseHighlight[]
        handleHighlightsLoaded(data)
      } catch (caughtError) {
        if ((caughtError as Error).name !== 'AbortError') {
          handleHighlightsLoaded([])
        }
      }
    }

    fetchHighlights()
    return () => controller.abort()
  }, [book, chapter, version, onHighlightsLoaded])

  useEffect(() => {
    if (!onVerseTap) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      if (typeof event.data !== 'object' || event.data === null) {
        return
      }

      const payload = event.data as {
        type?: string
        text?: string
        verseNumber?: number | null
        startVerse?: number
        endVerse?: number
        x?: number
        y?: number
      }

      if (payload.type === 'bible-highlights-ready') {
        syncHighlightsToIframe()
        syncReadingSettingsToIframe()
        syncSelectionToIframe()
        return
      }

      if (payload.type !== 'bible-verse-tap') {
        if (payload.type === 'bible-text-selection') {
          onVerseTap({
            interaction: 'selection',
            text: payload.text ?? '',
            startVerse: typeof payload.startVerse === 'number' ? payload.startVerse : undefined,
            endVerse: typeof payload.endVerse === 'number' ? payload.endVerse : undefined,
            position:
              typeof payload.x === 'number' && typeof payload.y === 'number'
                ? { x: payload.x, y: payload.y }
                : undefined,
          })
        }
        return
      }

      onVerseTap({
        interaction: 'tap',
        text: payload.text ?? '',
        verseNumber: typeof payload.verseNumber === 'number' ? payload.verseNumber : undefined,
        position:
          typeof payload.x === 'number' && typeof payload.y === 'number'
            ? { x: payload.x, y: payload.y }
            : undefined,
      })
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [onVerseTap, syncHighlightsToIframe, syncReadingSettingsToIframe, syncSelectionToIframe])

  useEffect(() => {
    syncHighlightsToIframe()
  }, [syncHighlightsToIframe])

  useEffect(() => {
    syncReadingSettingsToIframe()
  }, [syncReadingSettingsToIframe])

  useEffect(() => {
    syncSelectionToIframe()
  }, [syncSelectionToIframe])

  if (isLoading) {
    return <ChapterSkeleton />
  }

  if (error) {
    return <ChapterError error={error} onRetry={onRetry} />
  }

  return (
    <iframe
      ref={iframeRef}
      data-testid="bible-chapter-content"
      title="bible-chapter-content"
      srcDoc={interactiveContent}
      className="w-full flex-1 min-h-0"
      sandbox="allow-same-origin allow-scripts"
      onLoad={syncHighlightsToIframe}
    />
  )
}
