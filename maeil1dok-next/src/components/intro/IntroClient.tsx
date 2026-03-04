'use client'

import { useState, useMemo, useCallback } from 'react'
import { CheckCircle, ArrowLeft, Play } from 'lucide-react'
import type { VideoBibleIntro, VideoIntroProgress } from '@/types'
import { cn } from '@/lib/utils'

/* ─── types ─── */

interface PlanInfo {
  id: number
  name: string
}

interface IntroClientProps {
  plans: PlanInfo[]
  videoIntros: VideoBibleIntro[]
  progressList: VideoIntroProgress[]
}

/* ─── helpers ─── */

function extractYoutubeId(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
  return match?.[1] || ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/* ─── component ─── */

export default function IntroClient({ plans, videoIntros, progressList }: IntroClientProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    plans.length > 0 ? String(plans[0].id) : '',
  )
  const [selectedVideo, setSelectedVideo] = useState<VideoBibleIntro | null>(null)
  const [progress, setProgress] = useState<VideoIntroProgress[]>(progressList)
  const [isToggling, setIsToggling] = useState(false)

  /* ─── derived state ─── */

  const filteredVideos = useMemo(() => {
    if (!selectedPlanId) return videoIntros
    return videoIntros.filter((v) => v.planId === Number(selectedPlanId))
  }, [selectedPlanId, videoIntros])

  const isVideoCompleted = useCallback(
    (videoId: string): boolean => {
      return progress.some((p) => p.videoIntroId === videoId && p.isCompleted)
    },
    [progress],
  )

  const completedCount = useMemo(() => {
    return filteredVideos.filter((v) => isVideoCompleted(v.id)).length
  }, [filteredVideos, isVideoCompleted])

  const progressPercent = filteredVideos.length > 0
    ? (completedCount / filteredVideos.length) * 100
    : 0

  /* ─── handlers ─── */

  const handleToggleComplete = async (videoIntroId: string) => {
    if (isToggling) return
    setIsToggling(true)

    const currentlyCompleted = isVideoCompleted(videoIntroId)

    try {
      const res = await fetch('/api/intro/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIntroId,
          completed: !currentlyCompleted,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update progress')
      }

      const result: { data: VideoIntroProgress } = await res.json()

      setProgress((prev) => {
        const existing = prev.findIndex((p) => p.videoIntroId === videoIntroId)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = result.data
          return updated
        }
        return [...prev, result.data]
      })
    } finally {
      setIsToggling(false)
    }
  }

  /* ================================================================ */
  /*  DETAIL VIEW — single video intro (matches production intro.vue)  */
  /* ================================================================ */

  if (selectedVideo) {
    const youtubeId = extractYoutubeId(selectedVideo.urlLink)
    const completed = isVideoCompleted(selectedVideo.id)

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
          {/* Back / List button */}
          <div className="fade-in flex items-center px-4 pt-3 pb-1">
            <button
              type="button"
              onClick={() => setSelectedVideo(null)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full',
                'px-3 py-1.5 text-sm font-medium',
                'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
                'border border-[var(--color-border-default)]',
                'transition-colors hover:bg-[var(--color-button-hover)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              목록
            </button>
          </div>

          <main className="flex flex-col gap-5 px-4 pt-4">
            {/* ─── Video Card ─── */}
            <div
              className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]"
              style={{ animationDelay: '0.1s' }}
            >
              {/* 16:9 iframe */}
              <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={`${selectedVideo.book} 개론`}
                />
              </div>

              {/* YouTube deep-link */}
              <a
                href={selectedVideo.urlLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3',
                  'border-t border-[var(--color-border-light)] dark:border-[var(--color-border-default)]',
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
                  'text-sm font-medium transition-colors hover:bg-[var(--color-button-hover)]',
                )}
              >
                <Play className="h-4 w-4" />
                YouTube 앱으로 시청하기
              </a>
            </div>

            {/* ─── Content Card ─── */}
            <div
              className="fade-in min-h-[200px] overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-6 shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="mb-6 border-b border-dashed border-[var(--color-border-default)] pb-6 text-center">
                <h2
                  className="text-2xl font-bold text-[var(--color-text-primary)]"
                  style={{ fontFamily: '"Noto Serif KR", "KoPub Batang", serif' }}
                >
                  {selectedVideo.book} 개론
                </h2>
              </div>
              <p
                className="text-center text-[var(--color-text-secondary)] leading-relaxed"
                style={{ fontFamily: '"Noto Serif KR", "KoPub Batang", serif', fontSize: '1.05rem', lineHeight: '1.8', wordBreak: 'keep-all' }}
              >
                {selectedVideo.book}의 전체적인 흐름과 주제를 이해하고 깊이 있게 말씀을 묵상해보세요.
              </p>
            </div>
          </main>

          {/* ─── Floating Completion Button ─── */}
          <div
            className="fade-in pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', animationDelay: '0.3s' }}
          >
            <div className="flex w-full max-w-[768px] justify-end px-6 pb-4 md:justify-center md:pr-0">
              <button
                type="button"
                data-testid="intro-complete-toggle"
                disabled={isToggling}
                onClick={() => handleToggleComplete(selectedVideo.id)}
                className={cn(
                  'pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70',
                  completed
                    ? 'bg-[#ef4444] shadow-[0_4px_14px_rgba(239,68,68,0.4)] hover:bg-[#dc2626]'
                    : 'bg-[var(--color-success)] shadow-[0_4px_14px_rgba(16,185,129,0.4)] hover:bg-[var(--color-accent-hover)]',
                )}
              >
                {isToggling ? (
                  <span className="loading-spinner small" />
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>{completed ? '완료 취소' : '완료'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ================================================================ */
  /*  LIST VIEW — video intro list                                     */
  /* ================================================================ */

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

      <div className="relative z-[1] mx-auto max-w-[768px] pb-12">
        <main className="flex flex-col gap-5 px-4 pt-5">

          {/* ─── Plan Selector ─── */}
          {plans.length > 1 && (
            <div className="fade-in" style={{ animationDelay: '0.05s' }}>
              <select
                data-testid="intro-plan-selector"
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value)
                  setSelectedVideo(null)
                }}
                className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={String(plan.id)}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ─── Progress Summary Card ─── */}
          <div
            className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] p-5 shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">진행률</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {completedCount} / {filteredVideos.length}
              </span>
            </div>
            {filteredVideos.length > 0 && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                <div
                  className="h-full rounded-full bg-[var(--color-success)] transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>

          {/* ─── Video List ─── */}
          <div data-testid="intro-video-list" className="flex flex-col gap-3">
            {filteredVideos.length === 0 ? (
              <div className="fade-in flex flex-col items-center justify-center py-12 text-center" style={{ animationDelay: '0.15s' }}>
                <div className="mb-3 text-4xl">📖</div>
            <p className="text-sm text-[var(--color-text-tertiary)]">등록된 개론 영상이 없습니다</p>
              </div>
            ) : (
              filteredVideos.map((video, index) => {
                const completed = isVideoCompleted(video.id)
                return (
                  <button
                    key={video.id}
                    type="button"
                    data-testid="intro-video-item"
                    onClick={() => setSelectedVideo(video)}
                    className={cn(
                      'fade-in w-full cursor-pointer overflow-hidden rounded-2xl border p-4 text-left',
                      'shadow-[var(--shadow-sm)] transition-all duration-200',
                      'hover:shadow-[var(--shadow-md)] active:scale-[0.98]',
                      'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]',
                      'dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]',
                      'dark:hover:border-[var(--color-border-light)]',
                    )}
                    style={{ animationDelay: `${0.15 + index * 0.03}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">{video.book}</div>
                        <div className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                          {formatDate(video.startDate)} ~ {formatDate(video.endDate)}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium',
                          completed
                            ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]',
                        )}
                      >
                        {completed ? '완료' : '미완료'}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
