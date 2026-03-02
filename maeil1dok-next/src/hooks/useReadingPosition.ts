import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPosition, savePosition } from '@/repositories/bible/readingPositionRepository'
import type { UserReadingPosition } from '@/types/profile'

interface SearchParamsLike {
  toString: () => string
  has: (key: string) => boolean
}

interface RouterLike {
  replace: (href: string) => void
}

interface UseReadingPositionOptions {
  book: string
  chapter: number
  verse: number | null
  version: string
  pathname: string
  searchParams: SearchParamsLike
  router: RouterLike
  onRestore: (position: UserReadingPosition) => void
  onError?: (error: Error) => void
}

const SAVE_DEBOUNCE_MS = 2000
const STORAGE_KEY = 'lastReadingPosition'

// --- localStorage helpers ---

interface LocalPosition {
  book: string
  chapter: number
  verse?: number | null
  scrollPosition?: number
  version: string
}

function loadFromLocalStorage(): UserReadingPosition | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed: LocalPosition = JSON.parse(stored)
    return {
      id: '',
      userId: '',
      book: parsed.book,
      chapter: parsed.chapter,
      verse: parsed.verse ?? null,
      scrollPosition: parsed.scrollPosition ?? 0,
      version: parsed.version,
      updatedAt: '',
    }
  } catch {
    return null
  }
}

function saveToLocalStorage(position: {
  book: string
  chapter: number
  verse: number | null
  version: string
  scrollPosition: number
}): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      book: position.book,
      chapter: position.chapter,
      verse: position.verse,
      scrollPosition: position.scrollPosition,
      version: position.version,
    }))
  } catch {
    // silently fail
  }
}

// --- DB row → UserReadingPosition mapper ---

function mapDbRow(row: {
  id: string
  user_id: string
  book: string
  chapter: number
  verse: number | null
  scroll_position: number
  version: string
  updated_at: string
}): UserReadingPosition {
  return {
    id: row.id,
    userId: row.user_id,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    scrollPosition: Number(row.scroll_position),
    version: row.version,
    updatedAt: row.updated_at,
  }
}

export function useReadingPosition({
  book,
  chapter,
  verse,
  version,
  pathname,
  searchParams,
  router,
  onRestore,
  onError,
}: UseReadingPositionOptions) {
  const supabase = useMemo(() => createClient(), [])
  const restoredRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousLocationRef = useRef({ book, chapter, version })
  const userRef = useRef<{ id: string } | null>(null)
  const latestPositionRef = useRef({
    book,
    chapter,
    verse,
    version,
    scrollPosition: 0,
  })

  const notifyError = useCallback((error: unknown) => {
    if (!onError) {
      return
    }

    if (error instanceof Error) {
      onError(error)
      return
    }

    onError(new Error('Failed to update reading position'))
  }, [onError])

  const persistPosition = useCallback(async (position: {
    book: string
    chapter: number
    verse: number | null
    version: string
    scrollPosition: number
  }) => {
    // Always save to localStorage
    saveToLocalStorage(position)

    // If authenticated, also save to Supabase
    const user = userRef.current
    if (!user) return

    try {
      const { error } = await savePosition(supabase, user.id, {
        book: position.book,
        chapter: position.chapter,
        verse: position.verse,
        scroll_position: position.scrollPosition,
        version: position.version,
      })
      if (error) notifyError(error)
    } catch (error) {
      notifyError(error)
    }
  }, [notifyError, supabase])

  useEffect(() => {
    latestPositionRef.current = {
      book,
      chapter,
      verse,
      version,
      scrollPosition: window.scrollY,
    }
  }, [book, chapter, verse, version])

  useEffect(() => {
    if (restoredRef.current) {
      return
    }

    restoredRef.current = true

    const hasBookOrChapterParams = searchParams.has('book') || searchParams.has('chapter')

    if (hasBookOrChapterParams) {
      return
    }

    let cancelled = false

    const restorePosition = async () => {
      try {
        let savedPosition: UserReadingPosition | null = null

        // Check auth and cache user for future saves
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        userRef.current = (!authError && user) ? user : null

        // Try Supabase first if authenticated
        if (userRef.current) {
          const { data, error } = await getPosition(supabase, userRef.current.id)
          if (!error && data) {
            savedPosition = mapDbRow(data as {
              id: string
              user_id: string
              book: string
              chapter: number
              verse: number | null
              scroll_position: number
              version: string
              updated_at: string
            })
          }
        }

        // Fallback to localStorage
        if (!savedPosition) {
          savedPosition = loadFromLocalStorage()
        }

        if (cancelled || !savedPosition) {
          return
        }

        const params = new URLSearchParams(searchParams.toString())
        params.set('book', savedPosition.book)
        params.set('chapter', String(savedPosition.chapter))
        params.set('version', savedPosition.version)

        onRestore(savedPosition)
        router.replace(`${pathname}?${params.toString()}`)

        if (savedPosition.scrollPosition > 0) {
          requestAnimationFrame(() => {
            window.scrollTo({ top: savedPosition!.scrollPosition, behavior: 'auto' })
          })
        }
      } catch (error) {
        // On any error, try localStorage as last resort
        const localFallback = loadFromLocalStorage()
        if (!cancelled && localFallback) {
          const params = new URLSearchParams(searchParams.toString())
          params.set('book', localFallback.book)
          params.set('chapter', String(localFallback.chapter))
          params.set('version', localFallback.version)
          onRestore(localFallback)
          router.replace(`${pathname}?${params.toString()}`)
        } else {
          notifyError(error)
        }
      }
    }

    void restorePosition()

    return () => {
      cancelled = true
    }
  }, [notifyError, onRestore, pathname, supabase, router, searchParams])

  useEffect(() => {
    const onScroll = () => {
      latestPositionRef.current.scrollPosition = window.scrollY

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        void persistPosition(latestPositionRef.current)
      }, SAVE_DEBOUNCE_MS)
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [persistPosition])

  useEffect(() => {
    const previous = previousLocationRef.current

    if (
      previous.book !== book
      || previous.chapter !== chapter
      || previous.version !== version
    ) {
      void persistPosition({
        ...latestPositionRef.current,
        book: previous.book,
        chapter: previous.chapter,
        version: previous.version,
      })
    }

    previousLocationRef.current = { book, chapter, version }
  }, [book, chapter, version, persistPosition])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      void persistPosition({
        ...latestPositionRef.current,
        scrollPosition: window.scrollY,
      })
    }
  }, [persistPosition])
}
