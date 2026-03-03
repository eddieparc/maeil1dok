'use client'

import { useState, useMemo, useCallback } from 'react'
import type { VideoBibleIntro, VideoIntroProgress } from '@/types'
import { Card, Button } from '@/components/ui'

interface PlanInfo {
  id: number
  name: string
}

interface IntroClientProps {
  plans: PlanInfo[]
  videoIntros: VideoBibleIntro[]
  progressList: VideoIntroProgress[]
}

function extractYoutubeId(url: string): string {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/)
  return match?.[1] || ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function IntroClient({ plans, videoIntros, progressList }: IntroClientProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    plans.length > 0 ? String(plans[0].id) : ''
  )
  const [selectedVideo, setSelectedVideo] = useState<VideoBibleIntro | null>(null)
  const [progress, setProgress] = useState<VideoIntroProgress[]>(progressList)
  const [isToggling, setIsToggling] = useState(false)

  const filteredVideos = useMemo(() => {
    if (!selectedPlanId) return videoIntros
    return videoIntros.filter(v => v.planId === Number(selectedPlanId))
  }, [selectedPlanId, videoIntros])

  const isVideoCompleted = useCallback((videoId: string): boolean => {
    return progress.some(p => p.videoIntroId === videoId && p.isCompleted)
  }, [progress])

  const completedCount = useMemo(() => {
    return filteredVideos.filter(v => isVideoCompleted(v.id)).length
  }, [filteredVideos, isVideoCompleted])

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

      setProgress(prev => {
        const existing = prev.findIndex(p => p.videoIntroId === videoIntroId)
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

  return (
    <div className="flex flex-col gap-4 py-6">
      {/* Plan Selector */}
      {plans.length > 1 && (
        <div className="mx-4 mb-4">
          <select
            data-testid="intro-plan-selector"
            value={selectedPlanId}
            onChange={(e) => {
              setSelectedPlanId(e.target.value)
              setSelectedVideo(null)
            }}
            className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
          >
            {plans.map(plan => (
              <option key={plan.id} value={String(plan.id)}>{plan.name}</option>
            ))}
          </select>
        </div>
      )}
      {/* Progress Summary */}
      <Card className="mx-4 mb-4 p-4">
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
      </Card>
      {/* Video Player */}
      {selectedVideo && (
        <div className="mx-4 mb-4">
          <div className="overflow-hidden rounded-xl bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${extractYoutubeId(selectedVideo.urlLink)}`}
              className="aspect-video w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${selectedVideo.book} 개론`}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedVideo.book} 개론</h2>
            <a
              href={selectedVideo.urlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-info)] hover:underline"
            >
              YouTube에서 보기
            </a>
          </div>
          <Button
            data-testid="intro-complete-toggle"
            onClick={() => handleToggleComplete(selectedVideo.id)}
            disabled={isToggling}
            variant={isVideoCompleted(selectedVideo.id) ? 'secondary' : 'primary'}
            className={`mt-3 w-full ${isVideoCompleted(selectedVideo.id) ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-transparent hover:bg-[var(--color-success-bg)]/80' : ''}`}
          >
            {isToggling
              ? '처리 중...'
              : isVideoCompleted(selectedVideo.id)
                ? '✓ 완료'
                : '완료로 표시'}
          </Button>
        </div>
      )}
      {/* Video List */}
      <div data-testid="intro-video-list">
        {filteredVideos.length === 0 ? (
          <p className="px-4 text-center text-sm text-[var(--color-text-tertiary)]">
            등록된 개론 영상이 없습니다
          </p>
        ) : (
          filteredVideos.map(video => {
            const completed = isVideoCompleted(video.id)
            const isSelected = selectedVideo?.id === video.id
            return (
              <Card
                key={video.id}
                data-testid="intro-video-item"
                onClick={() => setSelectedVideo(video)}
                variant={isSelected ? 'bordered' : 'default'}
                className={`mx-4 mb-3 cursor-pointer p-4 transition-colors ${
                  isSelected ? 'border-[var(--color-primary)] bg-[var(--color-info-bg)]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[var(--color-text-primary)]">{video.book}</div>
                    <div className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      {formatDate(video.startDate)} ~ {formatDate(video.endDate)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      completed
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'
                    }`}
                  >
                    {completed ? '완료' : '미완료'}
                  </span>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
