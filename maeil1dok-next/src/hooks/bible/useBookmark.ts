import { useCallback, useEffect, useRef, useState } from 'react'

interface BookmarkData {
  id: string
  book: string
  chapter: number
  bookmark_type: 'chapter' | 'verse'
  user_id: string
  created_at: string
  start_verse?: number | null
  end_verse?: number | null
  title?: string
  color?: string
}

interface UseBookmarkReturn {
  isBookmarked: boolean
  toggleBookmark: () => Promise<void>
  isLoading: boolean
}

/**
 * Hook for managing Bible bookmarks with optimistic updates
 * @param book - Bible book identifier (e.g., 'gen', 'mat')
 * @param chapter - Chapter number
 * @returns Object with isBookmarked state, toggleBookmark function, and isLoading state
 */
export function useBookmark(book: string, chapter: number): UseBookmarkReturn {
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const previousStateRef = useRef(false)

  // Fetch initial bookmark status
  useEffect(() => {
    const fetchBookmarkStatus = async () => {
      try {
        setIsLoading(true)
        const params = new URLSearchParams({
          book,
          chapter: String(chapter),
        })

        const response = await fetch(`/api/bible/bookmarks?${params.toString()}`, {
          method: 'GET',
        })

        if (!response.ok) {
          console.error('Failed to fetch bookmark status:', response.status)
          setIsBookmarked(false)
          return
        }

        const result = await response.json()
        const bookmarks = result.data || []

        // Check if there's a chapter-type bookmark for this book/chapter
        const hasBookmark = bookmarks.some(
          (b: BookmarkData) =>
            b.book === book && b.chapter === chapter && b.bookmark_type === 'chapter'
        )

        setIsBookmarked(hasBookmark)
      } catch (error) {
        console.error('Error fetching bookmark status:', error)
        setIsBookmarked(false)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchBookmarkStatus()
  }, [book, chapter])

  const toggleBookmark = useCallback(async () => {
    // Store previous state for rollback
    previousStateRef.current = isBookmarked

    // Optimistic update
    const newState = !isBookmarked
    setIsBookmarked(newState)

    try {
      if (newState) {
        // Adding bookmark
        const response = await fetch('/api/bible/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookmark_type: 'chapter',
            book,
            chapter,
            title: `${book} ${chapter}`,
          }),
        })

        if (!response.ok) {
          // Revert on error
          setIsBookmarked(previousStateRef.current)
          console.error('Failed to add bookmark:', response.status)
          return
        }
      } else {
        // Removing bookmark - need to find the bookmark ID first
        const params = new URLSearchParams({
          book,
          chapter: String(chapter),
        })

        const fetchResponse = await fetch(`/api/bible/bookmarks?${params.toString()}`, {
          method: 'GET',
        })

        if (!fetchResponse.ok) {
          setIsBookmarked(previousStateRef.current)
          console.error('Failed to fetch bookmark for deletion:', fetchResponse.status)
          return
        }

        const result = await fetchResponse.json()
        const bookmarks = result.data || []
        const bookmarkToDelete = bookmarks.find(
          (b: BookmarkData) =>
            b.book === book && b.chapter === chapter && b.bookmark_type === 'chapter'
        )

        if (!bookmarkToDelete) {
          setIsBookmarked(previousStateRef.current)
          console.error('Bookmark not found for deletion')
          return
        }

        const deleteParams = new URLSearchParams({
          id: bookmarkToDelete.id,
        })

        const deleteResponse = await fetch(`/api/bible/bookmarks?${deleteParams.toString()}`, {
          method: 'DELETE',
        })

        if (!deleteResponse.ok) {
          // Revert on error
          setIsBookmarked(previousStateRef.current)
          console.error('Failed to delete bookmark:', deleteResponse.status)
          return
        }
      }
    } catch (error) {
      // Revert on error
      setIsBookmarked(previousStateRef.current)
      console.error('Error toggling bookmark:', error)
    }
  }, [isBookmarked, book, chapter])

  return {
    isBookmarked,
    toggleBookmark,
    isLoading,
  }
}
