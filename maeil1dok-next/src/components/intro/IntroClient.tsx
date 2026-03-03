'use client'

import { useState, useMemo, useCallback } from 'react'
import { CheckCircle, ArrowLeft, Play, AlertCircle, RotateCcw } from 'lucide-react'
import type { VideoBibleIntro, VideoIntroProgress } from '@/types'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PlanInfo {
  id: number
  name: string
}

interface IntroClientProps {
  plans: PlanInfo[]
  videoIntros: VideoBibleIntro[]
  progressList: VideoIntroProgress[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractYoutubeId(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
  return match?.[1] || ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IntroClient({ plans, videoIntros, progressList }: IntroClientProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    plans.length > 0 ? String(plans[0].id) : '',
  )
  const [selectedVideo, setSelectedVideo] = useState<VideoBibleIntro | null>(null)
  const [progress, setProgress] = useState<VideoIntroProgress[]>(progressList)
  const [isToggling, setIsToggling] = useState(false)

  /* ---------- derived state ---------- */

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

  /* ---------- handlers ---------- */

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

  const handleSelectVideo = (video: VideoBibleIntro) => {
    setSelectedVideo(video)
  }

  const handleBackToList = () => {
    setSelectedVideo(null)
  }

  /* ================================================================ */
  /*  DETAIL VIEW — matches production intro.vue                       */
  /* ================================================================ */

  if (selectedVideo) {
    const youtubeId = extractYoutubeId(selectedVideo.urlLink)
    const completed = isVideoCompleted(selectedVideo.id)

    return (
      <>
        {/* Back / List button */}
        <div className="flex items-center px-4 pt-2 pb-1 fade-in">
          <button
            type="button"
            onClick={handleBackToList}
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

        <div className="flex flex-col gap-6 px-4 py-4">
          {/* ---- Video Card ---- */}
          <div
            className="fade-in overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-white shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]"
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

          {/* ---- Content Card ---- */}
          <div
            className="fade-in min-h-[200px] rounded-2xl border border-[var(--color-border-light)] bg-white p-6 shadow-[var(--shadow-md)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]"
            style={{ animationDelay: '0.2s' }}
          >
            {/* Bible Header */}
            <div className="mb-6 border-b border-dashed border-[var(--color-border-default)] pb-6 text-center">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-family-reading)' }}>
                {selectedVideo.book} 개론
              </h2>
            </div>

            {/* Description */}
            <p
              className="text-[var(--color-text-secondary)] leading-relaxed break-keep"
              style={{ fontFamily: 'var(--font-family-reading)', fontSize: '1.05rem', lineHeight: '1.8' }}
            >
              {selectedVideo.book}의 전체적인 흐름과 주제를 이해하고 깊이 있게 말씀을 묵상해보세요.
            </p>
          </div>
        </div>

        {/* ---- Floating Completion Button ---- */}
        <div
          className="fade-in pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
          style={{
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
            animationDelay: '0.3s',
          }}
        >
          <div className="flex w-full max-w-[768px] justify-end px-6 md:justify-center md:px-0">
            <button
              type="button"
              onClick={() => handleToggleComplete(selectedVideo.id)}
              disabled={isToggling}
              className={cn(
                'pointer-events-auto inline-flex items-center gap-2 rounded-full',
                'px-5 py-3 text-base font-semibold text-white',
                'transition-all duration-200 active:scale-95',
                'disabled:cursor-not-allowed disabled:opacity-70',
                completed
                  ? 'bg-[#ef4444] shadow-[0_4px_14px_rgba(239,68,68,0.4)] hover:bg-[#dc2626]'
                  : 'bg-[var(--color-success)] shadow-[0_4px_14px_rgba(16,185,129,0.4)] hover:bg-[var(--color-success)]/90',
              )}
            >
              {isToggling ? (
                <span className="loading-spinner small" />
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>{completed ? '완료 취소' : '완료'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </>
    )
  }

  /* ================================================================ */
  /*  LIST VIEW — video intro list                                     */
  /* ================================================================ */

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Plan Selector */}
      {plans.length > 1 && (
        <div className="px-4">
          <select
            data-testid="intro-plan-selector"
            value={selectedPlanId}
            onChange={(e) => {
              setSelectedPlanId(e.target.value)
              setSelectedVideo(null)
            }}
            className={cn(
              'w-full rounded-xl border border-[var(--color-border-default)]',
              'bg-[var(--color-bg-secondary)] p-2.5 text-sm text-[var(--color-text-primary)]',
              'focus:border-[var(--color-accent-primary)] focus:outline-none',
            )}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={String(plan.id)}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress Summary */}
      <div className="mx-4 rounded-2xl border border-[var(--color-border-light)] bg-white p-4 shadow-[var(--shadow-sm)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text-secondary)]">진행률</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {completedCount} / {filteredVideos.length}
          </span>
        </div>
        {filteredVideos.length > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--color-success)] transition-all duration-300"
              style={{ width: `${(completedCount / filteredVideos.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Video List */}
      <div data-testid="intro-video-list" className="flex flex-col gap-3 px-4">
        {filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <AlertCircle className="h-10 w-10 text-[var(--color-text-tertiary)]" />
            <p className="text-sm text-[var(--color-text-tertiary)]">등록된 개론 영상이 없습니다</p>
          </div>
        ) : (
          filteredVideos.map((video) => {
            const completed = isVideoCompleted(video.id)
            return (
              <button
                key={video.id}
                type="button"
                data-testid="intro-video-item"
                onClick={() => handleSelectVideo(video)}
                className={cn(
                  'w-full rounded-2xl border border-[var(--color-border-light)] bg-white p-4',
                  'shadow-[var(--shadow-sm)] transition-all duration-200',
                  'text-left hover:shadow-[var(--shadow-md)] hover:border-[var(--color-border-default)]',
                  'active:scale-[0.98]',
                  'dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]',
                  'dark:hover:border-[var(--color-border-light)]',
                )}
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
    </div>
  )
}
