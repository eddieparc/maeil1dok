'use client'

import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle, ChevronDown, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useModal } from '@/hooks/useModal'
import { useReadingSettings } from '@/hooks/bible/useReadingSettings'
import { FONT_FAMILIES, FONT_WEIGHTS } from '@/hooks/bible/ReadingSettingsContext'
import ReadingSettingsModal from '@/components/bible/ReadingSettingsModal'
import { cn } from '@/lib/utils'

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

interface ParsedBibleContent {
  title: string
  verses: Array<{ number: string; text: string }>
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

interface YouTubePlayerConstructor {
  new (
    elementId: string,
    options: {
      events?: {
        onReady?: (event: YouTubePlayerEvent) => void
      }
    }
  ): YouTubePlayer
}

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerConstructor
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

function parseSummarySections(summary: string): SummarySections {
  const normalized = summary.replace(/\r\n/g, '\n')
  let scriptureMatch = normalized.match(/\*\*오늘의 본문\*\*([\s\S]*?)(?=\*\*교역자 해설\*\*|$)/)
  let commentaryMatch = normalized.match(/\*\*교역자 해설\*\*([\s\S]*?)(?=\*\*.*하시조.*\*\*|$)/)
  let actionMatch = normalized.match(/\*\*.*하시조.*\*\*([\s\S]*)$/)

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

function renderTextWithBoldAndBreaks(value: string): ReactNode {
  const lines = value.split('\n')
  let lineCursor = 0

  return lines.map((line) => {
    const pieces: ReactNode[] = []
    const lineKey = `line-${lineCursor}-${line}`
    const regex = /\*\*(.+?)\*\*/g
    let lastIndex = 0
    let match = regex.exec(line)

    while (match) {
      if (match.index > lastIndex) {
        pieces.push(line.slice(lastIndex, match.index))
      }
      pieces.push(
        <span key={`bold-${lineCursor}-${match.index}`} className="highlight-text">
          {match[1]}
        </span>,
      )
      lastIndex = match.index + match[0].length
      match = regex.exec(line)
    }

    if (lastIndex < line.length) {
      pieces.push(line.slice(lastIndex))
    }

    lineCursor += line.length + 1

    return (
      <Fragment key={lineKey}>
        {pieces}
        {lineCursor <= value.length ? <br /> : null}
      </Fragment>
    )
  })
}

function parseChecklistItems(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*(\[\s*\])?\s*/, '').trim())
    .filter(Boolean)
}

function parseHasenaContent(html: string): ParsedBibleContent {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const title = doc.querySelector('.bible_tit')?.textContent?.trim() || '하세나하시조'
  const verseParagraphs = Array.from(doc.querySelectorAll('.bible_contents p'))

  const verses = verseParagraphs
    .map((verse) => {
      const number = verse.querySelector('.bullet_number')?.textContent?.trim()
      const text = verse.querySelector('.bullet_txt')?.textContent?.trim()
      if (!number || !text) return ''

      return { number, text }
    })
    .filter((verse): verse is { number: string; text: string } => Boolean(verse))

  return { title, verses }
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

export function HasenaClient({ initialStatus, initialStats, today, isAuthenticated }: HasenaClientProps) {
  const router = useRouter()
  const modal = useModal()
  const { settings } = useReadingSettings()
  const playerRef = useRef<YouTubePlayer | null>(null)

  const [isCompleted, setIsCompleted] = useState(initialStatus.isCompleted)
  const [isSaving, setIsSaving] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [stats] = useState(initialStats)

  const [currentVideoId, setCurrentVideoId] = useState('')
  const [mobileInfo] = useState(() => detectMobile())

  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)

  const [bibleTitle, setBibleTitle] = useState('하세나하시조')
  const [bibleContent, setBibleContent] = useState<Array<{ number: string; text: string }>>([])
  const [bibleLoading, setBibleLoading] = useState(true)
  const [bibleError, setBibleError] = useState<string | null>(null)
  const [isReadingSettingsOpen, setIsReadingSettingsOpen] = useState(false)

  const playlistId = process.env.NEXT_PUBLIC_HASENA_PLAYLIST_ID || 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'
  const videoUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}`

  const todayLabel = useMemo(
    () =>
      new Date(`${today}T00:00:00`).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    [today],
  )

  const parsedSummary = useMemo(() => parseSummarySections(summary), [summary])

  const verseContainerStyle = useMemo(
    () => ({
      fontFamily: FONT_FAMILIES[settings.fontFamily].css,
      fontSize: `${settings.fontSize}px`,
      fontWeight: FONT_WEIGHTS[settings.fontWeight],
      lineHeight: settings.lineHeight,
      textAlign: settings.textAlign,
    }),
    [settings],
  )

  useEffect(() => {
    let cancelled = false

    async function fetchHasenaBibleContent() {
      setBibleLoading(true)
      setBibleError(null)

      try {
        const response = await fetch(
          `/api/bible-proxy/hasena/write.php?bo_table=hasena_record&targetDate=${encodeURIComponent(today)}&forceView=true`,
        )

        if (!response.ok) {
          throw new Error('본문을 불러오는데 실패했습니다')
        }

        const html = await response.text()
        const parsed = parseHasenaContent(html)

        if (!cancelled) {
          setBibleTitle(parsed.title)
          setBibleContent(parsed.verses)
        }
      } catch {
        if (!cancelled) {
          setBibleError('오늘의 말씀을 불러올 수 없습니다')
          setBibleContent([])
        }
      } finally {
        if (!cancelled) {
          setBibleLoading(false)
        }
      }
    }

    void fetchHasenaBibleContent()

    return () => {
      cancelled = true
    }
  }, [today])

  useEffect(() => {
    const initializePlayer = () => {
      if (!window.YT?.Player) return

      playerRef.current = new window.YT.Player('hasena-youtube-player', {
        events: {
          onReady: (event) => {
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
        const script = document.createElement('script')
        script.id = 'youtube-iframe-api'
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
      window.onYouTubeIframeAPIReady = initializePlayer
    }

    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!currentVideoId || !isAuthenticated) return
    let cancelled = false

    const loadSummary = async () => {
      setSummaryLoading(true)
      setSummaryError(null)

      try {
        const response = await fetch(`/api/hasena/summary?videoId=${encodeURIComponent(currentVideoId)}`)
        if (!response.ok) {
          if (response.status === 404 || response.status === 401) {
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

    return () => {
      cancelled = true
    }
  }, [currentVideoId, isAuthenticated])

  const openYouTubeApp = useCallback(() => {
    if (!currentVideoId) return
    const webUrl = `https://www.youtube.com/watch?v=${currentVideoId}`

    if (mobileInfo.isIOS) {
      window.location.href = `youtube://watch?v=${currentVideoId}`
      setTimeout(() => {
        window.open(webUrl, '_blank')
      }, 2000)
      return
    }

    if (mobileInfo.isAndroid) {
      window.location.href = `intent://watch?v=${currentVideoId}#Intent;package=com.google.android.youtube;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
      return
    }

    window.open(webUrl, '_blank')
  }, [currentVideoId, mobileInfo])

  const handleToggleComplete = useCallback(async () => {
    if (isSaving) return

    if (!isAuthenticated) {
      window.location.href = '/login?next=/hasena'
      return
    }

    const nextCompleted = !isCompleted

    if (nextCompleted) {
      const confirmed = await modal.confirm({
        title: '오늘 하세나를 완료할까요?',
        description: '완료하면 기록이 저장됩니다.',
        confirmText: '완료하기',
        cancelText: '취소',
        icon: 'success',
      })

      if (!confirmed) return
    }

    setIsSaving(true)
    setToggleError(null)

    try {
      const response = await fetch('/api/hasena/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, completed: nextCompleted }),
      })

      if (!response.ok) {
        throw new Error('완료 처리 실패')
      }

      setIsCompleted(nextCompleted)
    } catch {
      setToggleError('완료 처리에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, isAuthenticated, isCompleted, modal, today])

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push('/')
  }, [router])

  return (
    <div className="relative min-h-screen bg-[var(--color-bg-primary)] font-[var(--font-family-ui)] text-[var(--color-text-primary)]">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(var(--color-text-tertiary) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-[1] mx-auto min-h-screen max-w-[768px] pb-24">
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--color-border-light)] bg-[var(--color-bg-primary)]/92 px-4 backdrop-blur-[8px]">
          <div className="mx-auto flex h-full items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="-ml-2 rounded-full p-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              aria-label="뒤로가기"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-lg font-semibold tracking-[-0.02em]">하세나</h1>
            <div className="w-8" aria-hidden="true" />
          </div>
        </header>

        <main className="flex flex-col gap-6 px-4 py-6">
          <section
            className="overflow-hidden rounded-[20px] border border-[var(--color-border-light)] bg-[var(--color-bg-card)] shadow-[var(--shadow-md)]"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="relative w-full">
              <div className="relative h-0 w-full bg-black pb-[56.25%]">
                <iframe
                  id="hasena-youtube-player"
                  src={videoUrl}
                  title="YouTube video player"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {mobileInfo.isMobile && currentVideoId ? (
                <button
                  type="button"
                  onClick={openYouTubeApp}
                  className="flex w-full items-center justify-center gap-2 bg-[var(--color-danger)] px-4 py-3 text-[0.9rem] font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
                >
                  <span className="text-base">▶</span>
                  YouTube 앱으로 시청하기
                </button>
              ) : null}
            </div>
          </section>

          <section
            className="overflow-hidden rounded-[20px] border border-[var(--color-border-light)] bg-[var(--color-bg-card)] shadow-[var(--shadow-md)]"
            style={{ animationDelay: '0.15s' }}
          >
            <button
              type="button"
              onClick={() => setIsSummaryExpanded((value) => !value)}
              aria-expanded={isSummaryExpanded}
              className="flex w-full items-center justify-between bg-transparent px-5 py-4 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-base font-bold text-[var(--color-text-primary)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 4V10M15 10V16M15 10H9M15 10H21M6 16V20M6 20V24M6 20H2M6 20H10" stroke="url(#ai-gradient)" strokeWidth="2" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="ai-gradient" x1="2" y1="4" x2="21" y2="24" gradientUnits="userSpaceOnUse">
                        <stop stopColor="var(--color-primary)" />
                        <stop offset="1" stopColor="var(--color-accent-hover)" />
                      </linearGradient>
                    </defs>
                  </svg>
                  AI 요약
                </span>
                <span className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-accent-light)] px-1.5 py-0.5 text-[0.65rem] font-bold tracking-[0.5px] text-[var(--color-accent-primary)]">
                  BETA
                </span>
              </div>

              <ChevronDown
                size={20}
                className={cn(
                  'shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-300',
                  isSummaryExpanded && 'rotate-180',
                )}
              />
            </button>

            <div
              className={cn(
                'overflow-hidden px-5 transition-all duration-300 ease-in-out',
                isSummaryExpanded ? 'max-h-[2000px] pb-5' : 'max-h-0 px-5 pb-0',
              )}
            >
              {summaryLoading ? (
                <div className="flex items-center gap-3 py-4 text-sm text-[var(--color-text-secondary)]">
                  <span className="loading-spinner" />
                  AI가 영상을 분석하고 있습니다...
                </div>
              ) : summaryError && !summary ? (
                <p className="rounded-lg bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text)]">{summaryError}</p>
              ) : summary ? (
                <div className="summary-content flex flex-col gap-6 py-2">
                  {parsedSummary.scripture ? (
                    <div>
                      <h4 className="mb-2 text-[0.9rem] font-semibold uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">오늘의 본문</h4>
                      <p className="text-[0.975rem] leading-7 text-[var(--color-text-primary)]">{renderTextWithBoldAndBreaks(parsedSummary.scripture)}</p>
                    </div>
                  ) : null}

                  {parsedSummary.commentary ? (
                    <div>
                      <h4 className="mb-2 text-[0.9rem] font-semibold uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">교역자 해설</h4>
                      <p className="text-[0.975rem] leading-7 text-[var(--color-text-primary)]">{renderTextWithBoldAndBreaks(parsedSummary.commentary)}</p>
                    </div>
                  ) : null}

                  {parsedSummary.action ? (
                    <>
                      <div className="h-px bg-[var(--color-border-light)] opacity-40" />
                      <div>
                        <h4 className="mb-2 text-[0.9rem] font-semibold uppercase tracking-[0.5px] text-[var(--color-text-tertiary)]">오늘의 하시조</h4>
                        <div className="flex flex-col gap-2">
                          {parseChecklistItems(parsedSummary.action).map((item) => (
                            <div key={item} className="flex items-start gap-3 py-0.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-1.5 shrink-0" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span className="flex-1 text-[0.975rem] leading-7 text-[var(--color-text-primary)]">{renderTextWithBoldAndBreaks(item)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-[var(--color-text-tertiary)]">오늘의 요약이 곧 준비됩니다</p>
              )}
            </div>
          </section>

          <section
            className="overflow-hidden rounded-[20px] border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-md)]"
            style={{ animationDelay: '0.2s' }}
          >
            {bibleLoading ? (
              <div className="flex flex-col items-center gap-4 py-12 text-[var(--color-text-secondary)]">
                <span className="loading-spinner" />
                <p className="text-sm">오늘의 말씀을 불러오고 있습니다...</p>
              </div>
            ) : bibleError ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-xl font-bold text-[var(--color-danger)]">!</div>
                <h3 className="text-base font-semibold">말씀을 불러올 수 없습니다</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{bibleError}</p>
              </div>
            ) : (
              <div>
                <div className="mb-8 border-b border-dashed border-[var(--color-border-default)] pb-6 text-center">
                  <div className="relative mb-3 flex items-center justify-center gap-3">
                    <span className="inline-block rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-sm font-semibold text-[var(--color-accent-primary)]">
                      {todayLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsReadingSettingsOpen(true)}
                      className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-accent-primary-light)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-accent-primary)] active:scale-95"
                      aria-label="읽기 설정"
                      title="읽기 설정"
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                  </div>

                  <h2 className="font-[var(--font-family-reading)] text-2xl font-bold text-[var(--color-text-primary)]">{bibleTitle}</h2>
                </div>

                <div className="verse-container" style={verseContainerStyle}>
                  {bibleContent.map((verse) => (
                    <div key={`${verse.number}-${verse.text}`} className="hasena-verse">
                      <span className="hasena-verse-number">{verse.number}</span>
                      <span className="hasena-verse-text">{verse.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {isAuthenticated ? (
            <section className="rounded-[20px] border border-[var(--color-border-light)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-md)]">
              <div className="flex justify-around">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-[var(--color-warning)]">{stats.currentStreak}</span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">현재 연속</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-[var(--color-primary)]">{stats.longestStreak}</span>
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
            </section>
          ) : null}
        </main>

        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex w-full max-w-[768px] justify-end px-6 pb-4 md:justify-center md:px-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleToggleComplete()}
              className={cn(
                'pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70',
                isCompleted
                  ? 'bg-[var(--color-danger)] hover:opacity-90'
                  : 'bg-[var(--color-success)] hover:opacity-90',
              )}
            >
              {isSaving ? (
                <span className="loading-spinner" />
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>{isCompleted ? '미완료로 변경' : '완료하기'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {toggleError ? (
          <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm text-white shadow-lg">
            {toggleError}
          </div>
        ) : null}
      </div>

      <ReadingSettingsModal
        isOpen={isReadingSettingsOpen}
        onClose={() => setIsReadingSettingsOpen(false)}
      />

      <style jsx global>{`
        .hasena-verse {
          display: flex;
          align-items: flex-start;
          margin-bottom: 0.75rem;
          line-height: 1.8;
        }

        .hasena-verse-number {
          color: var(--color-accent-primary);
          font-weight: 600;
          margin-right: 0.5rem;
          min-width: 1.2rem;
          font-size: 0.85em;
          padding-top: 0.2em;
          font-family: var(--font-family-ui);
        }

        .hasena-verse-text {
          color: var(--color-text-primary);
          flex: 1;
          word-break: keep-all;
          overflow-wrap: break-word;
        }

        .highlight-text {
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .loading-spinner {
          width: 1.5rem;
          height: 1.5rem;
          border: 2px solid var(--color-border-default);
          border-top-color: var(--color-accent-primary);
          border-radius: 50%;
          animation: hasena-spin 1s linear infinite;
        }

        @keyframes hasena-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
