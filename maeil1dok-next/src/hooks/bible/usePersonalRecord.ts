import { useCallback, useEffect, useState } from 'react'
import { BIBLE_BOOKS } from '@/lib/bible/books'

interface PersonalRecordData {
  id: string
  book: string
  chapter: number
  read_date: string
  created_at: string
}

interface BookProgress {
  read: number
  total: number
}

interface UsePersonalRecordReturn {
  readChapters: number[]
  markAsRead: (chapter: number) => Promise<void>
  isChapterRead: (chapter: number) => boolean
  getBookProgress: () => BookProgress
  isLoading: boolean
}

/**
 * Hook for managing personal Bible reading records
 * Tracks which chapters a user has read for a specific book
 * @param book - Bible book identifier (e.g., 'gen', 'mat')
 * @returns Object with read chapters, markAsRead function, and progress tracking
 */
export function usePersonalRecord(book: string): UsePersonalRecordReturn {
  const [readChapters, setReadChapters] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch read chapters on mount
  useEffect(() => {
    const fetchReadChapters = async () => {
      try {
        setIsLoading(true)
        const params = new URLSearchParams({
          book,
        })

        const response = await fetch(`/api/bible/personal-records?${params.toString()}`, {
          method: 'GET',
        })

        if (!response.ok) {
          console.error('Failed to fetch read chapters:', response.status)
          setReadChapters([])
          return
        }

        const result = await response.json()
        const records = result.data || []

        // Extract unique chapter numbers and sort them
        const chapters = records.map((r: PersonalRecordData) => r.chapter)
        const uniqueSorted = [...new Set<number>(chapters)].sort((a: number, b: number) => a - b)

        setReadChapters(uniqueSorted)
      } catch (error) {
        console.error('Error fetching read chapters:', error)
        setReadChapters([])
      } finally {
        setIsLoading(false)
      }
    }

    void fetchReadChapters()
  }, [book])

  const markAsRead = useCallback(
    async (chapter: number): Promise<void> => {
      try {
        setIsLoading(true)

        // Get today's date in ISO format
        const today = new Date().toISOString().split('T')[0]

        const response = await fetch('/api/bible/personal-records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book,
            chapter,
            read_date: today,
          }),
        })

        if (!response.ok) {
          // Handle 409 conflict (already exists) as success
          if (response.status === 409) {
            // Add to local state if not already there
            setReadChapters(prev => {
              if (prev.includes(chapter)) {
                return prev
              }
              return [...prev, chapter].sort((a, b) => a - b)
            })
            return
          }

          console.error('Failed to mark chapter as read:', response.status)
          throw new Error(`Failed to mark chapter as read: ${response.status}`)
        }

        // Update local state
        setReadChapters(prev => {
          if (prev.includes(chapter)) {
            return prev
          }
          return [...prev, chapter].sort((a, b) => a - b)
        })
      } catch (error) {
        console.error('Error marking chapter as read:', error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [book]
  )

  const isChapterRead = useCallback(
    (chapter: number): boolean => {
      return readChapters.includes(chapter)
    },
    [readChapters]
  )

  const getBookProgress = useCallback((): BookProgress => {
    const totalChapters = BIBLE_BOOKS[book]?.chapters || 0
    return {
      read: readChapters.length,
      total: totalChapters,
    }
  }, [book, readChapters])

  return {
    readChapters,
    markAsRead,
    isChapterRead,
    getBookProgress,
    isLoading,
  }
}
