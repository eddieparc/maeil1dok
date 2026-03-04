'use client'

import { useState, useMemo, useCallback } from 'react'
import { Check, CheckCircle, ArrowLeft, Play, ChevronDown, ChevronRight } from 'lucide-react'
import type { VideoBibleIntro, VideoIntroProgress } from '@/types'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui'

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

type IntroStatus = 'missed' | 'current' | 'upcoming'

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
  const [isToggling, setIsToggling] = useState<Record<string, boolean>>({})
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)

  /* ─── derived state ─── */

  const filteredVideos = useMemo(() => {
    if (!selectedPlanId) return videoIntros
    return videoIntros.filter((v) => v.planId === Number(selectedPlanId))
  }, [selectedPlanId, videoIntros])

  const progressMap = useMemo(() => {
    return new Map(progress.map((p) => [p.videoIntroId, p.isCompleted]))
  }, [progress])

  const isVideoCompleted = useCallback((videoId: string): boolean => {
    return progressMap.get(videoId) ?? false
  }, [progressMap])

  const selectedPlanName = useMemo(() => {
    if (!selectedPlanId) return '플랜 선택'
    return plans.find((plan) => String(plan.id) === selectedPlanId)?.name ?? '플랜 선택'
  }, [plans, selectedPlanId])

  const getVideoStatus = useCallback((video: VideoBibleIntro): IntroStatus => {
    const today = new Date()
    const startDate = new Date(video.startDate)
    const endDate = new Date(video.endDate)

    today.setHours(0, 0, 0, 0)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(0, 0, 0, 0)

    if (today >= startDate && today <= endDate) {
      return 'current'
    }

    if (endDate < today) {
      return 'missed'
    }

    return 'upcoming'
  }, [])

  const handleToggleComplete = async (videoIntroId: string, completed: boolean) => {
    if (isToggling[videoIntroId]) return
    setIsToggling((prev) => ({ ...prev, [videoIntroId]: true }))

    try {
      const res = await fetch('/api/intro/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIntroId,
          completed,
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
      setIsToggling((prev) => ({ ...prev, [videoIntroId]: false }))
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
                disabled={isToggling[selectedVideo.id]}
                onClick={() => handleToggleComplete(selectedVideo.id, !completed)}
                className={cn(
                  'pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70',
                  completed
                    ? 'bg-[#ef4444] shadow-[0_4px_14px_rgba(239,68,68,0.4)] hover:bg-[#dc2626]'
                    : 'bg-[var(--color-success)] shadow-[0_4px_14px_rgba(16,185,129,0.4)] hover:bg-[var(--color-accent-hover)]',
                )}
              >
                {isToggling[selectedVideo.id] ? (
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
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(var(--color-text-tertiary) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-[1] mx-auto max-w-[768px] pb-12">
        <div className="px-4">
          <PageHeader
            title="개론"
            className="py-4"
            action={(
              <button
                type="button"
                data-testid="intro-plan-selector"
                onClick={() => setIsPlanModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-dark)] hover:bg-[var(--color-button-hover)] hover:text-[var(--color-text-primary)]"
              >
                <span>{selectedPlanName}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          />
        </div>

        <main className="px-4">
          <div data-testid="intro-video-list" className="flex flex-col gap-3">
            {filteredVideos.length === 0 ? (
              <div className="fade-in flex flex-col items-center justify-center py-12 text-center" style={{ animationDelay: '0.15s' }}>
                <div className="mb-3 text-4xl">📖</div>
                <p className="text-sm text-[var(--color-text-tertiary)]">등록된 개론 영상이 없습니다</p>
              </div>
            ) : (
              filteredVideos.map((video, index) => {
                const completed = isVideoCompleted(video.id)
                const status = getVideoStatus(video)
                const youtubeId = extractYoutubeId(video.urlLink)
                const thumbnailUrl = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : ''

                const statusClass =
                  status === 'current'
                    ? 'border border-[var(--color-schedule-location-border)] bg-[var(--color-schedule-location-bg-light)] text-[var(--color-schedule-location-text)]'
                    : status === 'missed'
                      ? 'border border-[var(--color-slate-200)] bg-[var(--color-slate-100)] text-[var(--color-slate-600)]'
                      : 'border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'

                const statusText = status === 'current' ? '현재 주차' : status === 'missed' ? '미완료' : '예정'

                return (
                  <button
                    key={video.id}
                    type="button"
                    data-testid="intro-video-item"
                    onClick={() => setSelectedVideo(video)}
                    className={cn(
                      'fade-in w-full overflow-hidden rounded-2xl border text-left',
                      'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-sm)]',
                      'transition-all duration-200 hover:border-[var(--color-border-dark)] hover:shadow-[var(--shadow-md)] active:scale-[0.99]',
                      completed ? 'opacity-90' : '',
                    )}
                    style={{ animationDelay: `${0.15 + index * 0.03}s` }}
                  >
                    <div className="flex items-start gap-3 p-3.5">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={completed}
                          disabled={isToggling[video.id]}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleToggleComplete(video.id, e.target.checked)}
                          className="h-5 w-5 cursor-pointer rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
                          aria-label={`${video.book} 완료 여부`}
                        />
                      </div>

                      <div className="h-[60px] w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)]">
                        {thumbnailUrl ? (
                          <img src={thumbnailUrl} alt={`${video.book} 개론 썸네일`} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[var(--color-text-tertiary)]">NO IMG</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            {formatDate(video.startDate)} ~ {formatDate(video.endDate)}
                          </span>
                          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                            성경개론
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{video.book}</p>
                      </div>

                      <div className="ml-2 flex shrink-0 items-center gap-1.5 pt-0.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', statusClass)}>
                          {statusText}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--color-slate-400)]" />
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </main>
      </div>

      {isPlanModalOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setIsPlanModalOpen(false)}
            aria-label="플랜 선택 닫기"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 pb-6 pt-4 shadow-[0_-12px_30px_-18px_rgba(0,0,0,0.45)]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[var(--color-border-default)]" />
            <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">플랜 선택</p>
            <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
              {plans.map((plan) => {
                const isSelected = String(plan.id) === selectedPlanId
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(String(plan.id))
                      setSelectedVideo(null)
                      setIsPlanModalOpen(false)
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-light)] text-[var(--color-text-primary)]'
                        : 'border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
                    )}
                  >
                    <span className="text-sm font-medium">{plan.name}</span>
                    <span className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-white'
                        : 'border-[var(--color-border-default)] text-transparent',
                    )}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
