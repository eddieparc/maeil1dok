import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClientRepositories } from '@/repositories/factory'
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
  const repositories = useMemo(() => createClientRepositories(createClient()), [])
  const restoredRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousLocationRef = useRef({ book, chapter, version })
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
    try {
      await repositories.profile.updateReadingPosition(position)
    } catch (error) {
      notifyError(error)
    }
  }, [notifyError, repositories.profile])

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
        const savedPosition = await repositories.profile.getReadingPosition()
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
            window.scrollTo({ top: savedPosition.scrollPosition, behavior: 'auto' })
          })
        }
      } catch (error) {
        notifyError(error)
      }
    }

    void restorePosition()

    return () => {
      cancelled = true
    }
  }, [notifyError, onRestore, pathname, repositories.profile, router, searchParams])

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
