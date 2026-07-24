// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useNote } from '../useNote'

// Mock fetch globally
global.fetch = vi.fn()

describe('useNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state and fetch', () => {
    it('initializes and fetches notes on mount', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Note 1', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockNotes }),
      })

      const { result } = renderHook(() => useNote('gen', 1))

      // Wait for fetch to complete and isLoading to be false
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.notes).toEqual(mockNotes)
      expect(result.current.noteCount).toBe(1)
    })

    it('fetches notes with correct book and chapter parameters', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      renderHook(() => useNote('exo', 2))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('book=exo')
      expect(callUrl).toContain('chapter=2')
    })

    it('calculates noteCount correctly from fetched notes', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Note 1', created_at: '2026-03-02' },
        { id: '2', book: 'gen', chapter: 1, content: 'Note 2', created_at: '2026-03-02' },
        { id: '3', book: 'gen', chapter: 1, content: 'Note 3', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockNotes }),
      })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.noteCount).toBe(3)
      })
    })

    it('handles fetch error gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to load notes' }),
      })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.notes).toEqual([])
        expect(result.current.noteCount).toBe(0)
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('starts with empty notes before fetch completes', () => {
      ;(global.fetch as any).mockReturnValueOnce(
        new Promise(() => {
          // Never resolves
        })
      )

      const { result } = renderHook(() => useNote('gen', 1))

      // Initially empty
      expect(result.current.notes).toEqual([])
      expect(result.current.noteCount).toBe(0)
    })
  })

  describe('createNote', () => {
    it('creates a new note and adds it to notes array', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, content: 'New note', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.notes).toEqual([])
      })

      await act(async () => {
        await result.current.createNote('New note')
      })

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
        expect(result.current.notes[0].content).toBe('New note')
      })
    })

    it('sends correct POST request with book, chapter, and content', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, content: 'Test', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await act(async () => {
        await result.current.createNote('Test')
      })

      const createCall = (global.fetch as any).mock.calls[1]
      expect(createCall[0]).toBe('/api/bible/notes')
      expect(createCall[1].method).toBe('POST')
      const body = JSON.parse(createCall[1].body)
      expect(body.book).toBe('gen')
      expect(body.chapter).toBe(1)
      expect(body.content).toBe('Test')
    })

    it('includes optional verse parameter when provided', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, start_verse: 5, content: 'Test', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await act(async () => {
        await result.current.createNote('Test', 5)
      })

      const createCall = (global.fetch as any).mock.calls[1]
      const body = JSON.parse(createCall[1].body)
      expect(body.start_verse).toBe(5)
      expect(body.end_verse).toBe(5)
    })

    it('sends both verse bounds as null when no verse is provided', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, content: 'Test', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await act(async () => {
        await result.current.createNote('Test')
      })

      const createCall = (global.fetch as any).mock.calls[1]
      const body = JSON.parse(createCall[1].body)
      expect(body.start_verse).toBeNull()
      expect(body.end_verse).toBeNull()
    })

    it('updates noteCount after creating a note', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, content: 'New note', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.noteCount).toBe(0)
      })

      await act(async () => {
        await result.current.createNote('New note')
      })

      await waitFor(() => {
        expect(result.current.noteCount).toBe(1)
      })
    })
  })

  describe('updateNote', () => {
    it('updates an existing note', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Original', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockNotes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, content: 'Updated', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
      })

      await act(async () => {
        await result.current.updateNote('1', 'Updated')
      })

      await waitFor(() => {
        expect(result.current.notes[0].content).toBe('Updated')
      })
    })

    it('sends correct PATCH request', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Original', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockNotes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: '1', book: 'gen', chapter: 1, content: 'Updated', created_at: '2026-03-02' },
          }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
      })

      await act(async () => {
        await result.current.updateNote('1', 'Updated')
      })

      const updateCall = (global.fetch as any).mock.calls[1]
      expect(updateCall[0]).toBe('/api/bible/notes/1')
      expect(updateCall[1].method).toBe('PATCH')
      const body = JSON.parse(updateCall[1].body)
      expect(body.content).toBe('Updated')
    })
  })

  describe('deleteNote', () => {
    it('deletes a note from the array', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Note 1', created_at: '2026-03-02' },
        { id: '2', book: 'gen', chapter: 1, content: 'Note 2', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockNotes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(2)
      })

      await act(async () => {
        await result.current.deleteNote('1')
      })

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
        expect(result.current.notes[0].id).toBe('2')
      })
    })

    it('sends correct DELETE request', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Note 1', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockNotes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
      })

      await act(async () => {
        await result.current.deleteNote('1')
      })

      const deleteCall = (global.fetch as any).mock.calls[1]
      expect(deleteCall[0]).toBe('/api/bible/notes/1')
      expect(deleteCall[1].method).toBe('DELETE')
    })

    it('updates noteCount after deleting a note', async () => {
      const mockNotes = [
        { id: '1', book: 'gen', chapter: 1, content: 'Note 1', created_at: '2026-03-02' },
        { id: '2', book: 'gen', chapter: 1, content: 'Note 2', created_at: '2026-03-02' },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockNotes }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      const { result } = renderHook(() => useNote('gen', 1))

      await waitFor(() => {
        expect(result.current.noteCount).toBe(2)
      })

      await act(async () => {
        await result.current.deleteNote('1')
      })

      await waitFor(() => {
        expect(result.current.noteCount).toBe(1)
      })
    })
  })

  describe('different book/chapter combinations', () => {
    it('fetches notes for different books', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '1', book: 'exo', chapter: 2, content: 'Exodus note', created_at: '2026-03-02' }],
        }),
      })

      const { result } = renderHook(() => useNote('exo', 2))

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1)
        expect(result.current.notes[0].book).toBe('exo')
      })

      const fetchCall = (global.fetch as any).mock.calls[0]
      expect(fetchCall[0]).toContain('book=exo')
      expect(fetchCall[0]).toContain('chapter=2')
    })
  })
})
