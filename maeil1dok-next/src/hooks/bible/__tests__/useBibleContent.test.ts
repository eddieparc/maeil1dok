// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BibleVersion } from '@/lib/bible/books'
import type { ReadingSettings } from '@/hooks/bible/ReadingSettingsContext'
import { useBibleContent } from '../useBibleContent'
import { parseKntContent } from '@/lib/bible/parsers/kntParser'
import { parseStandardContent } from '@/lib/bible/parsers/standardParser'
import { parseWooriContent } from '@/lib/bible/parsers/wooriParser'

vi.mock('@/lib/bible/parsers/kntParser', () => ({
  parseKntContent: vi.fn(),
}))

vi.mock('@/lib/bible/parsers/standardParser', () => ({
  parseStandardContent: vi.fn(),
}))

vi.mock('@/lib/bible/parsers/wooriParser', () => ({
  parseWooriContent: vi.fn(),
}))

const DEFAULT_SETTINGS: ReadingSettings = {
  theme: 'light',
  fontFamily: 'kopub-batang',
  fontSize: 16,
  fontWeight: 'medium',
  lineHeight: 1.6,
  textAlign: 'left',
  verseJoining: false,
  showVerseNumbers: true,
  tongdokAutoComplete: false,
  showDescription: true,
  showCrossRef: true,
  highlightNames: true,
  showFootnotes: false,
}

function responseMock(body: { text?: string; json?: unknown }) {
  return {
    ok: true,
    status: 200,
    text: vi.fn(async () => body.text ?? ''),
    json: vi.fn(async () => body.json ?? {}),
  } as unknown as Response
}

describe('useBibleContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sets loading true while request is in-flight', async () => {
    const fetchMock = vi.mocked(fetch)
    let resolveFetch: ((value: Response) => void) | undefined

    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    vi.mocked(parseStandardContent).mockReturnValue({ html: '<div>ok</div>' })

    const { result } = renderHook(() =>
      useBibleContent('gen', 1, 'GAE', DEFAULT_SETTINGS),
    )

    expect(result.current.isLoading).toBe(true)

    resolveFetch?.(responseMock({ text: '<html>standard</html>' }))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('loads KNT content via KNT parser with reading options', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      responseMock({ json: { found: true, reference: '창세기 1', content: '<p>...</p>' } }),
    )

    vi.mocked(parseKntContent).mockReturnValue({ html: '<div>knt parsed</div>', title: '창세기 1장' })

    const customSettings: ReadingSettings = {
      ...DEFAULT_SETTINGS,
      showDescription: false,
      showCrossRef: false,
      showFootnotes: true,
    }

    const { result } = renderHook(() =>
      useBibleContent('gen', 1, 'KNT', customSettings),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bible-proxy/KNT/korbibReadpage.php?version=KNT&book=gen&chap=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(parseKntContent).toHaveBeenCalledWith(
      { found: true, reference: '창세기 1', content: '<p>...</p>' },
      {
        showDescription: false,
        showCrossRef: false,
        showFootnotes: true,
      },
    )
    expect(result.current.content).toBe('<div>knt parsed</div>')
    expect(result.current.chapterTitle).toBe('창세기 1장')
    expect(result.current.error).toBeNull()
  })

  it('loads standard content via standard parser for non-KNT/WOORI versions', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(responseMock({ text: '<html>standard payload</html>' }))

    vi.mocked(parseStandardContent).mockReturnValue({ html: '<div>standard parsed</div>', title: '창세기 1장' })

    const { result } = renderHook(() =>
      useBibleContent('gen', 1, 'GAE', DEFAULT_SETTINGS),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bible-proxy/bible/korbibReadpage.php?version=GAE&book=gen&chap=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(parseStandardContent).toHaveBeenCalledWith('<html>standard payload</html>')
    expect(result.current.content).toBe('<div>standard parsed</div>')
    expect(result.current.chapterTitle).toBe('창세기 1장')
  })

  it('loads WOORI content via WOORI parser', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(responseMock({ json: { found: true, verses: [{ verse: 1, text: '태초에' }] } }))

    vi.mocked(parseWooriContent).mockReturnValue({ html: '<div>woori parsed</div>', title: '창세기 1장' })

    const { result } = renderHook(() =>
      useBibleContent('gen', 1, 'WOORI', DEFAULT_SETTINGS),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(parseWooriContent).toHaveBeenCalledWith({ found: true, verses: [{ verse: 1, text: '태초에' }] })
    expect(result.current.content).toBe('<div>woori parsed</div>')
  })

  it('aborts in-flight request when dependencies change', async () => {
    const fetchMock = vi.mocked(fetch)
    const signals: AbortSignal[] = []

    fetchMock.mockImplementationOnce((_url, init) => {
      const signal = (init as RequestInit).signal as AbortSignal
      signals.push(signal)

      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    fetchMock.mockResolvedValueOnce(responseMock({ text: '<html>chapter2</html>' }))
    vi.mocked(parseStandardContent).mockReturnValue({ html: '<div>chapter2</div>' })

    const { result, rerender } = renderHook(
      ({ chapter, version }: { chapter: number; version: BibleVersion }) =>
        useBibleContent('gen', chapter, version, DEFAULT_SETTINGS),
      {
        initialProps: { chapter: 1, version: 'GAE' as BibleVersion },
      },
    )

    rerender({ chapter: 2, version: 'GAE' as BibleVersion })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(signals[0]?.aborted).toBe(true)
    expect(result.current.content).toBe('<div>chapter2</div>')
  })

  it('sets error state when fetch fails', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockRejectedValueOnce(new Error('Network failure'))

    const { result } = renderHook(() =>
      useBibleContent('gen', 1, 'GAE', DEFAULT_SETTINGS),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBe('Network failure')
    expect(result.current.content).toBeNull()
    expect(result.current.chapterTitle).toBeNull()
  })
})
