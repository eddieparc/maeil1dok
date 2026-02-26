'use client'

import { useState, useMemo, useCallback } from 'react'
import type { VideoBibleIntro, VideoIntroProgress } from '@/types'

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
    <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }} className="py-6 pb-20">
      <h1 className="mb-4 px-4 text-2xl font-bold text-gray-900">성경 개론</h1>

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
            className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm focus:border-blue-400 focus:outline-none"
          >
            {plans.map(plan => (
              <option key={plan.id} value={String(plan.id)}>{plan.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Progress Summary */}
      <div className="mx-4 mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">진행률</span>
          <span className="text-sm font-medium text-gray-900">
            {completedCount} / {filteredVideos.length}
          </span>
        </div>
        {filteredVideos.length > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${(completedCount / filteredVideos.length) * 100}%` }}
            />
          </div>
        )}
      </div>

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
            <h2 className="text-lg font-semibold text-gray-900">{selectedVideo.book} 개론</h2>
            <a
              href={selectedVideo.urlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline"
            >
              YouTube에서 보기
            </a>
          </div>
          <button
            data-testid="intro-complete-toggle"
            onClick={() => handleToggleComplete(selectedVideo.id)}
            disabled={isToggling}
            className={`mt-3 w-full rounded-xl py-2.5 text-sm font-medium transition-colors ${
              isVideoCompleted(selectedVideo.id)
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-900 text-white'
            } disabled:opacity-50`}
          >
            {isToggling
              ? '처리 중...'
              : isVideoCompleted(selectedVideo.id)
                ? '✓ 완료'
                : '완료로 표시'}
          </button>
        </div>
      )}

      {/* Video List */}
      <div data-testid="intro-video-list">
        {filteredVideos.length === 0 ? (
          <p className="px-4 text-center text-sm text-gray-500">
            등록된 개론 영상이 없습니다
          </p>
        ) : (
          filteredVideos.map(video => {
            const completed = isVideoCompleted(video.id)
            const isSelected = selectedVideo?.id === video.id
            return (
              <div
                key={video.id}
                data-testid="intro-video-item"
                onClick={() => setSelectedVideo(video)}
                className={`mx-4 mb-3 cursor-pointer rounded-2xl p-4 shadow-sm transition-colors ${
                  isSelected
                    ? 'border-2 border-blue-400 bg-blue-50'
                    : 'border-2 border-transparent bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{video.book}</div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {formatDate(video.startDate)} ~ {formatDate(video.endDate)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      completed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {completed ? '완료' : '미완료'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
