'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── types ─── */

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
  isAuthenticated: boolean
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

/* ─── helpers ─── */

function parseSummarySections(summary: string): SummarySections {
  const normalized = summary.replace(/\r\n/g, '\n')

  // Try new format first
  let scriptureMatch = normalized.match(/\*\*오늘의 본문\*\*([\s\S]*?)(?=\*\*교역자 해설\*\*|$)/)
  let commentaryMatch = normalized.match(/\*\*교역자 해설\*\*([\s\S]*?)(?=\*\*.*하시조.*\*\*|$)/)
  let actionMatch = normalized.match(/\*\*.*하시조.*\*\*([\s\S]*)$/)

  // Try old numbered format
  if (!scriptureMatch?.[1]?.trim() && !commentaryMatch?.[1]?.trim() && !actionMatch?.[1]?.trim()) {
    scriptureMatch = normalized.match(/1\.\s*\*\*오늘의 본문\*\*[:\s]*([\s\S]*?)(?=2\.\s*\*\*교역자 해설\*\*)/)
    commentaryMatch = normalized.match(/2\.\s*\*\*교역자 해설\*\*[:\s]*([\s\S]*?)(?=3\.\s*\*\*.*하시조.*\*\*)/)
    actionMatch = normalized.match(/3\.\s*\*\*.*하시조.*\*\*[:\s]*([\s\S]*)$/)
  }

  const scripture = scriptureMatch?.[1]?.trim() ?? ''
  const commentary = commentaryMatch?.[1]?.trim() ?? ''
  const action = actionMatch?.[1]?.trim() ?? ''

  if (!scripture && !commentary && !action) {
    return { scripture: '', commentary: normalized.trim(), action: '' }
  }

  return { scripture, commentary, action }
}

function renderMarkdown(value: string): string {
  return value.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-[var(--color-text-primary)]">$1</strong>')
}

function parseChecklistItems(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*(\[\s*\])?\s*/, '').trim())
    .filter(Boolean)
}

function detectMobile(): { isMobile: boolean; isIOS: boolean; isAndroid: boolean } {
  if (typeof navigator === 'undefined') return { isMobile: false, isIOS: false, isAndroid: false }
  const ua = navigator.userAgent
  return {
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
    isIOS: /iPhone|iPad|iPod/i.test(ua),
    isAndroid: /Android/i.test(ua),
  }
}

/* ─── component ─── */

export function HasenaClient({ initialStatus, initialStats, today, isAuthenticated }: HasenaClientProps) {
  const playerRef = useRef<YouTubePlayer | null>(null)

  // Core state
  const [isCompleted, setIsCompleted] = useState(initialStatus.isCompleted)
  const [stats, setStats] = useState<HasenaStats>(initialStats)
  const [isSaving, setIsSaving] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  // YouTube state
  const [currentVideoId, setCurrentVideoId] = useState('')
  const [mobileInfo] = useState(() => detectMobile())

  // AI Summary state
  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)

  // Calendar modal state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  /* ─── YouTube setup ─── */
  useEffect(() => {
    const playlistId = process.env.NEXT_PUBLIC_HASENA_PLAYLIST_ID || ''
    if (!playlistId) return

    const initializePlayer = () => {
      if (!window.YT?.Player) return

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
            if (videoId) setCurrentVideoId(videoId)
          },
          onStateChange: (event) => {
            const playing = window.YT?.PlayerState?.PLAYING
            const cued = window.YT?.PlayerState?.CUED
            if (event.data !== playing && event.data !== cued) return
            const videoId = event.target.getVideoData().video_id
            if (videoId) setCurrentVideoId(videoId)
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

  /* ─── Load AI summary ─── */
  useEffect(() => {
    if (!currentVideoId) return
    let cancelled = false

    const loadSummary = async () => {
      setSummaryLoading(true)
      setSummaryError(null)

      try {
        const response = await fetch(`/api/hasena/summary?videoId=${encodeURIComponent(currentVideoId)}`)
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) setSummary('')
            return
          }
          throw new Error('요약을 불러오지 못했습니다')
        }

        const data: { summary?: string } = await response.json()
        if (!cancelled) setSummary(data.summary ?? '')
      } catch {
        if (!cancelled) {
          setSummaryError('요약을 준비 중입니다')
          setSummary('')
        }
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }

    void loadSummary()
    return () => { cancelled = true }
  }, [currentVideoId])

  /* ─── Parsed summary ─── */
  const parsedSummary = useMemo(() => parseSummarySections(summary), [summary])

  /* ─── Completion toggle ─── */
  const handleToggleComplete = useCallback(async () => {
    if (isSaving) return

    if (!isAuthenticated) {
      window.location.href = `/login?next=/hasena`
      return
    }

    const nextCompleted = !isCompleted
    setIsSaving(true)
    setToggleError(null)

    try {
      const response = await fetch('/api/hasena/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, completed: nextCompleted }),
      })

      if (!response.ok) throw new Error('완료 상태를 저장하지 못했습니다')

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
  }, [isSaving, isAuthenticated, isCompleted, today])

  /* ─── YouTube deep-link ─── */
  const openYouTubeApp = useCallback(() => {
    if (!currentVideoId) return
    const webUrl = `https://www.youtube.com/watch?v=${currentVideoId}`

    if (mobileInfo.isIOS) {
      window.location.href = `youtube://watch?v=${currentVideoId}`
      setTimeout(() => { window.open(webUrl, '_blank') }, 2000)
    } else if (mobileInfo.isAndroid) {
      window.location.href = `intent://watch?v=${currentVideoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
    } else {
      window.open(webUrl, '_blank')
    }
  }, [currentVideoId, mobileInfo])

  const playlistConfigured = Boolean(process.env.NEXT_PUBLIC_HASENA_PLAYLIST_ID)
  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="sanctuary-theme relative min-h-screen">
      {/* Background pattern */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(var(--color-text-tertiary) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-[1] mx-auto max-w-[768px] pb-28">
        {/* Main content */}
        <main className="flex flex-col gap-5 px-4 pt-5">

          {/* ─── Video Card ─── */}
          <div className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]" style={{ animationDelay: '0.1s' }}>
            {playlistConfigured ? (
              <div className="relative w-full">
                {/* 16:9 aspect ratio container */}
                <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
                  <div
                    id="youtube-player"
                    data-testid="youtube-player"
                    className="absolute inset-0"
                  />
                </div>

                {/* YouTube deep-link button */}
                {mobileInfo.isMobile && currentVideoId ? (
                  <button
                    type="button"
                    onClick={openYouTubeApp}
                    className="flex w-full items-center justify-center gap-2 bg-[#ff0000] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#cc0000] active:bg-[#aa0000]"
                  >
                    <span className="text-base">▶</span>
                    YouTube 앱으로 시청하기
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-center bg-[var(--color-bg-tertiary)]" style={{ paddingBottom: '56.25%', position: 'relative' }}>
                <span className="absolute inset-0 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
                  재생목록 설정이 필요합니다
                </span>
              </div>
            )}
          </div>

          {/* ─── AI Summary Accordion ─── */}
          <div className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]" style={{ animationDelay: '0.15s' }}>
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => setIsSummaryExpanded((v) => !v)}
              aria-expanded={isSummaryExpanded}
              className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--color-bg-tertiary)]"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-base font-bold text-[var(--color-text-primary)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 4V10M15 10V16M15 10H9M15 10H21M6 16V20M6 20V24M6 20H2M6 20H10" stroke="url(#ai-gradient)" strokeWidth="2" strokeLinecap="round"/>
                    <defs>
                      <linearGradient id="ai-gradient" x1="2" y1="4" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366f1"/>
                        <stop offset="1" stopColor="#a855f7"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  AI 요약
                </span>
                <span className="rounded-md border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.1)] px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide text-[var(--color-accent-primary)]">
                  BETA
                </span>
              </div>
              <ChevronDown
                size={20}
                className={cn(
                  'shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-300',
                  isSummaryExpanded && 'rotate-180'
                )}
              />
            </button>

            {/* Accordion content */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out',
                isSummaryExpanded ? 'max-h-[2000px] pb-5' : 'max-h-0'
              )}
            >
              <div className="px-5">
                {summaryLoading ? (
                  <div className="flex items-center gap-3 py-4 text-sm text-[var(--color-text-secondary)]">
                    <span className="loading-spinner" />
                    AI가 영상을 분석하고 있습니다...
                  </div>
                ) : summaryError && !summary ? (
                  <p className="rounded-lg bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
                    {summaryError}
                  </p>
                ) : summary ? (
                  <div className="flex flex-col gap-5 pt-1">
                    {/* Scripture section */}
                    {parsedSummary.scripture ? (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          오늘의 본문
                        </h4>
                        <p
                          className="text-[0.95rem] leading-7 text-[var(--color-text-primary)]"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(parsedSummary.scripture).replace(/\n/g, '<br/>') }}
                        />
                      </div>
                    ) : null}

                    {/* Commentary section */}
                    {parsedSummary.commentary ? (
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          교역자 해설
                        </h4>
                        <p
                          className="text-[0.95rem] leading-7 text-[var(--color-text-primary)]"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(parsedSummary.commentary).replace(/\n/g, '<br/>') }}
                        />
                      </div>
                    ) : null}

                    {/* Action checklist */}
                    {parsedSummary.action ? (
                      <>
                        <hr className="border-[var(--color-border-light)] opacity-40" />
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            오늘의 하시조
                          </h4>
                          <div className="flex flex-col gap-2">
                            {parseChecklistItems(parsedSummary.action).map((item, i) => (
                              <div key={i} className="flex items-start gap-3 py-0.5">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="var(--color-accent-primary)"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="mt-1.5 shrink-0"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span
                                  className="flex-1 text-[0.95rem] leading-7 text-[var(--color-text-primary)]"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(item) }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <p className="py-4 text-center text-sm text-[var(--color-text-tertiary)]">
                    오늘의 요약이 곧 준비됩니다
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ─── Bible Content Card ─── */}
          <div className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-6 shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]" style={{ animationDelay: '0.2s' }}>
            <div className="mb-6 border-b border-dashed border-[var(--color-border-default)] pb-5 text-center">
              <span className="inline-block rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-sm font-semibold text-[var(--color-accent-primary)]">
                {todayLabel}
              </span>
              <h2 className="mt-3 text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: '"Noto Serif KR", "KoPub Batang", serif' }}>
                하세나하시조
              </h2>
            </div>
            <p className="text-center text-sm leading-relaxed text-[var(--color-text-secondary)]">
              오늘의 하세나 본문은 영상과 AI 요약에서 함께 확인하세요.
            </p>
          </div>

          {/* ─── Streak Stats + Calendar (logged-in only) ─── */}
          {isAuthenticated ? (
            <div className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-5 shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]" style={{ animationDelay: '0.25s' }}>
              {/* Streak stats row */}
              <div className="flex justify-around mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-orange-500">{stats.currentStreak}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">현재 연속</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-yellow-500">{stats.longestStreak}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">최장 연속</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-[var(--color-accent-primary)]">{stats.totalCompleted}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">총 완료</span>
                  </div>
                </div>
              </div>

              {/* Calendar button */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)] px-4 py-3.5 text-sm font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-button-hover)] hover:border-[var(--color-border-default)] active:scale-[0.98]"
              >
                <Calendar size={20} className="shrink-0 text-[var(--color-accent-primary)]" />
                <span className="flex-1 text-left">전체 기록 보기</span>
                <ChevronRight size={16} className="shrink-0 text-[var(--color-text-tertiary)]" />
              </button>
            </div>
          ) : null}
        </main>

        {/* ─── Floating Completion Button ─── */}
        <div className="fade-in pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', animationDelay: '0.3s' }}>
          <div className="flex w-full max-w-[768px] justify-end px-6 pb-4 md:justify-center md:pr-0">
            <button
              type="button"
              data-testid="hasena-complete-toggle"
              disabled={isSaving}
              onClick={handleToggleComplete}
              className={cn(
                'pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70',
                isCompleted
                  ? 'bg-[#ef4444] shadow-[0_4px_14px_rgba(239,68,68,0.4)] hover:bg-[#dc2626]'
                  : 'bg-[var(--color-success)] shadow-[0_4px_14px_rgba(16,185,129,0.4)] hover:bg-[var(--color-accent-hover)]'
              )}
            >
              {isSaving ? (
                <span className="loading-spinner small" />
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>{isCompleted ? '미완료로 변경' : '완료하기'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error toast */}
        {toggleError ? (
          <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm text-white shadow-lg">
            {toggleError}
          </div>
        ) : null}

        {/* ─── Calendar Modal ─── */}
        {isCalendarOpen ? (
          <CalendarModal onClose={() => setIsCalendarOpen(false)} />
        ) : null}
      </div>
    </div>
  )
}

/* ─── Calendar Modal (lightweight placeholder) ─── */

function CalendarModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--color-bg-primary)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">전체 기록</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-button-hover)]"
          >
            ✕
          </button>
        </div>
        <p className="text-center text-sm text-[var(--color-text-secondary)]">
          달력 기능은 곧 제공될 예정입니다
        </p>
      </div>
    </div>
  )
}
