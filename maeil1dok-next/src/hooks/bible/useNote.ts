import { useState, useEffect } from 'react'

export interface Note {
  id: string
  book: string
  chapter: number
  start_verse?: number | null
  end_verse?: number | null
  content: string
  is_private?: boolean
  created_at: string
  updated_at?: string
}

interface UseNoteReturn {
  notes: Note[]
  noteCount: number
  createNote: (content: string, verse?: number) => Promise<void>
  updateNote: (id: string, content: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  isLoading: boolean
}

/**
 * useNote Hook
 *
 * Manages note CRUD operations for a specific Bible book and chapter.
 * Fetches notes on mount and provides methods to create, update, and delete notes.
 *
 * @param book - Bible book code (e.g., 'gen', 'exo')
 * @param chapter - Chapter number
 * @returns Object with notes array, noteCount, CRUD methods, and loading state
 */
export function useNote(book: string, chapter: number): UseNoteReturn {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch notes on mount and when book/chapter changes
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          book,
          chapter: chapter.toString(),
        })
        const response = await fetch(`/api/bible/notes?${params}`)

        if (!response.ok) {
          console.error('Failed to fetch notes:', response.statusText)
          setNotes([])
          return
        }

        const result = await response.json()
        setNotes(result.data || [])
      } catch (error) {
        console.error('Error fetching notes:', error)
        setNotes([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchNotes()
  }, [book, chapter])

  const createNote = async (content: string, verse?: number): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/bible/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book,
          chapter,
          start_verse: verse ?? null,
          content,
          is_private: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create note')
      }

      const result = await response.json()
      setNotes((prev) => [...prev, result.data])
    } catch (error) {
      console.error('Error creating note:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const updateNote = async (id: string, content: string): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/bible/notes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update note')
      }

      const result = await response.json()
      setNotes((prev) => prev.map((note) => (note.id === id ? result.data : note)))
    } catch (error) {
      console.error('Error updating note:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteNote = async (id: string): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/bible/notes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      setNotes((prev) => prev.filter((note) => note.id !== id))
    } catch (error) {
      console.error('Error deleting note:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    notes,
    noteCount: notes.length,
    createNote,
    updateNote,
    deleteNote,
    isLoading,
  }
}
