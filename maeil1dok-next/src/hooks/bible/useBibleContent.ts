import { useEffect, useState } from 'react'

import type { BibleVersion } from '@/lib/bible/books'
import type { ParseResult } from '@/lib/bible/parsers/common'
import { parseKntContent } from '@/lib/bible/parsers/kntParser'
import { parseStandardContent } from '@/lib/bible/parsers/standardParser'
import { parseWooriContent } from '@/lib/bible/parsers/wooriParser'

import type { ReadingSettings } from './ReadingSettingsContext'

interface UseBibleContentResult {
  content: string | null
  isLoading: boolean
  error: string | null
  chapterTitle: string | null
}

function getProxyPrefix(version: BibleVersion): 'KNT' | 'bible' {
  return version === 'KNT' ? 'KNT' : 'bible'
}

function getBibleContentUrl(book: string, chapter: number, version: BibleVersion): string {
  const prefix = getProxyPrefix(version)
  return `/api/bible-proxy/${prefix}/korbibReadpage.php?version=${version}&book=${book}&chap=${chapter}`
}

export function useBibleContent(
  book: string,
  chapter: number,
  version: BibleVersion,
  settings: ReadingSettings,
): UseBibleContentResult {
  const [content, setContent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chapterTitle, setChapterTitle] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const url = getBibleContentUrl(book, chapter, version)

    async function loadContent() {
      try {
        setIsLoading(true)
        setError(null)
        setContent(null)
        setChapterTitle(null)

        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load bible content (${response.status})`)
        }

        let parsed: ParseResult
        if (version === 'KNT') {
          const payload = await response.json()
          parsed = parseKntContent(payload, {
            showDescription: settings.showDescription,
            showCrossRef: settings.showCrossRef,
            showFootnotes: settings.showFootnotes,
          })
        } else if (version === 'WOORI') {
          const payload = await response.json()
          parsed = parseWooriContent(payload)
        } else {
          const rawHtml = await response.text()
          parsed = parseStandardContent(rawHtml)
        }

        if (controller.signal.aborted) {
          return
        }

        setContent(parsed.html)
        setChapterTitle(parsed.title ?? null)
        setError(parsed.error ?? null)
      } catch (caughtError) {
        if ((caughtError as Error).name === 'AbortError') {
          return
        }

        setContent(null)
        setChapterTitle(null)
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load bible content',
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadContent()

    return () => {
      controller.abort()
    }
  }, [book, chapter, version, settings.showDescription, settings.showCrossRef, settings.showFootnotes])

  return {
    content,
    isLoading,
    error,
    chapterTitle,
  }
}

export type { UseBibleContentResult }
