'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface HasenaStatus {
  date: string
  isCompleted: boolean
}

interface HasenaStats {
  totalCompleted: number
  currentStreak: number
  longestStreak: number
}

interface HasenaClientProps {
  initialStatus: HasenaStatus
  initialStats: HasenaStats
  today: string
}

interface SummarySections {
  scripture: string
  commentary: string
  action: string
}

interface YouTubePlayer {
  destroy: () => void
  getVideoData: () => { video_id?: string }
}

interface YouTubePlayerEvent {
  target: YouTubePlayer
}

interface YouTubeStateEvent extends YouTubePlayerEvent {
  data: number
}

interface YouTubePlayerConstructor {
  new (
    elementId: string,
    options: {
      height: string
      width: string
      playerVars: {
        listType: 'playlist'
        list: string
        autoplay: 0 | 1
      }
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void
        onStateChange?: (event: YouTubeStateEvent) => void
      }
    }
  ): YouTubePlayer
}

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerConstructor
      PlayerState?: {
        PLAYING?: number
        CUED?: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

function parseSummarySections(summary: string): SummarySections {
  const normalized = summary.replace(/\r\n/g, '\n')

  const scriptureMatch = normalized.match(/\*\*오늘의 본문\*\*([\s\S]*?)(?=\*\*교역자 해설\*\*|$)/)
  const commentaryMatch = normalized.match(/\*\*교역자 해설\*\*([\s\S]*?)(?=\*\*오늘의 하시조\*\*|$)/)
  const actionMatch = normalized.match(/\*\*오늘의 하시조\*\*([\s\S]*)$/)

  const scripture = scriptureMatch?.[1]?.trim() ?? ''
  const commentary = commentaryMatch?.[1]?.trim() ?? ''
  const action = actionMatch?.[1]?.trim() ?? ''

  if (!scripture && !commentary && !action) {
    return {
      scripture: '',
      commentary: normalized.trim(),
      action: '',
    }
  }

  return { scripture, commentary, action }
}

function renderText(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, '$1')
}

export function HasenaClient({ initialStatus, initialStats, today }: HasenaClientProps) {
  const playerRef = useRef<YouTubePlayer | null>(null)

  const [isCompleted, setIsCompleted] = useState(initialStatus.isCompleted)
  const [stats, setStats] = useState<HasenaStats>(initialStats)
  const [isSaving, setIsSaving] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const [currentVideoId, setCurrentVideoId] = useState('')
  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<'scripture' | 'commentary' | 'action' | null>('scripture')

  const toggleSection = (section: 'scripture' | 'commentary' | 'action') => {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  useEffect(() => {
    const playlistId = process.env.NEXT_PUBLIC_HASENA_PLAYLIST_ID || ''
    if (!playlistId) {
      return
    }

    const initializePlayer = () => {
      if (!window.YT?.Player) {
        return
      }

      playerRef.current = new window.YT.Player('youtube-player', {
        height: '315',
        width: '100%',
        playerVars: {
          listType: 'playlist',
          list: playlistId,
          autoplay: 0,
        },
        events: {
          onReady: (event) => {
            const videoId = event.target.getVideoData().video_id
            if (videoId) {
              setCurrentVideoId(videoId)
            }
          },
          onStateChange: (event) => {
            const playing = window.YT?.PlayerState?.PLAYING
            const cued = window.YT?.PlayerState?.CUED
            if (event.data !== playing && event.data !== cued) {
              return
            }

            const videoId = event.target.getVideoData().video_id
            if (videoId) {
              setCurrentVideoId(videoId)
            }
          },
        },
      })
    }

    if (window.YT?.Player) {
      initializePlayer()
    } else {
      const existingScript = document.getElementById('youtube-iframe-api')
      if (!existingScript) {
        const tag = document.createElement('script')
        tag.id = 'youtube-iframe-api'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      window.onYouTubeIframeAPIReady = initializePlayer
    }

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
      window.onYouTubeIframeAPIReady = undefined
    }
  }, [])

  useEffect(() => {
    if (!currentVideoId) {
      return
    }

    let cancelled = false

    const loadSummary = async () => {
      setSummaryLoading(true)
      setSummaryError(null)

      try {
        const response = await fetch(`/api/hasena/summary?videoId=${encodeURIComponent(currentVideoId)}`)
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) {
              setSummary('')
            }
            return
          }
          throw new Error('요약을 불러오지 못했습니다')
        }

        const data: { summary?: string } = await response.json()
        if (!cancelled) {
          setSummary(data.summary ?? '')
        }
      } catch {
        if (!cancelled) {
          setSummaryError('요약을 준비 중입니다')
          setSummary('')
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [currentVideoId])

  const parsedSummary = useMemo(() => parseSummarySections(summary), [summary])

  const handleToggleComplete = async () => {
    if (isSaving) {
      return
    }

    const nextCompleted = !isCompleted
    setIsSaving(true)
    setToggleError(null)

    try {
      const response = await fetch('/api/hasena/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: today,
          completed: nextCompleted,
        }),
      })

      if (!response.ok) {
        throw new Error('완료 상태를 저장하지 못했습니다')
      }

      setIsCompleted(nextCompleted)
      setStats((prev) => {
        const totalCompleted = nextCompleted
          ? prev.totalCompleted + 1
          : Math.max(0, prev.totalCompleted - 1)

        const currentStreak = nextCompleted
          ? prev.currentStreak + 1
          : Math.max(0, prev.currentStreak - 1)

        return {
          totalCompleted,
          currentStreak,
          longestStreak: Math.max(prev.longestStreak, currentStreak),
        }
      })
    } catch {
      setToggleError('완료 상태를 저장하지 못했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  const playlistConfigured = Boolean(process.env.NEXT_PUBLIC_HASENA_PLAYLIST_ID)
  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="mx-auto max-w-md py-6">
      <section className="bg-white rounded-2xl shadow-sm mx-4 mb-4 p-4">
        <div className="mb-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-gray-500">HASENA</p>
          <h1 className="text-lg font-semibold text-gray-900">하세나하시조</h1>
        </div>
        {playlistConfigured ? (
          <div id="youtube-player" data-testid="youtube-player" className="w-full overflow-hidden rounded-xl bg-gray-100" />
        ) : (
          <div className="flex h-[315px] items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500">
            재생목록 설정이 필요합니다
          </div>
        )}
      </section>

      <div data-testid="hasena-streak" className="flex justify-around gap-4 p-4 bg-white rounded-2xl shadow-sm mx-4 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold">🔥{stats.currentStreak}</div>
          <div className="text-xs text-gray-500">연속</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold">🏆{stats.longestStreak}</div>
          <div className="text-xs text-gray-500">최장</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold">📅{stats.totalCompleted}</div>
          <div className="text-xs text-gray-500">총 완료</div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm mx-4 mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{todayLabel}</p>
            <p className="text-sm font-medium text-gray-900">오늘의 하세나</p>
          </div>
          <button
            type="button"
            data-testid="hasena-complete-toggle"
            disabled={isSaving}
            onClick={handleToggleComplete}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
              isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {isSaving ? '저장 중...' : isCompleted ? '✓ 완료' : '완료하기'}
          </button>
        </div>
        {toggleError ? <p className="text-xs text-red-600">{toggleError}</p> : null}
      </section>

      <section className="bg-white rounded-2xl shadow-sm mx-4 mb-4 p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">AI 요약</h2>
        {summaryLoading ? (
          <p className="text-sm text-gray-500">요약을 불러오는 중입니다...</p>
        ) : summaryError ? (
          <p className="text-sm text-gray-500">{summaryError}</p>
        ) : !summary ? (
          <p className="text-sm text-gray-500">요약을 준비 중입니다</p>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection('scripture')}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left"
            >
              <span className="text-sm font-medium text-gray-900">오늘의 본문</span>
              <span className="text-xs text-gray-500">{openSection === 'scripture' ? '접기' : '펼치기'}</span>
            </button>
            {openSection === 'scripture' ? (
              <p className="whitespace-pre-line rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700">{renderText(parsedSummary.scripture || '요약을 준비 중입니다')}</p>
            ) : null}

            <button
              type="button"
              onClick={() => toggleSection('commentary')}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left"
            >
              <span className="text-sm font-medium text-gray-900">교역자 해설</span>
              <span className="text-xs text-gray-500">{openSection === 'commentary' ? '접기' : '펼치기'}</span>
            </button>
            {openSection === 'commentary' ? (
              <p className="whitespace-pre-line rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700">{renderText(parsedSummary.commentary || '요약을 준비 중입니다')}</p>
            ) : null}

            <button
              type="button"
              onClick={() => toggleSection('action')}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left"
            >
              <span className="text-sm font-medium text-gray-900">오늘의 하시조</span>
              <span className="text-xs text-gray-500">{openSection === 'action' ? '접기' : '펼치기'}</span>
            </button>
            {openSection === 'action' ? (
              <p className="whitespace-pre-line rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-700">{renderText(parsedSummary.action || '요약을 준비 중입니다')}</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm mx-4 mb-4 p-4">
        <h2 className="text-sm font-semibold text-gray-900">오늘의 본문</h2>
        <p className="mt-2 text-sm text-gray-600">오늘의 하세나 본문은 영상과 AI 요약에서 함께 확인하세요.</p>
      </section>
    </div>
  )
}
