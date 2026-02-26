'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BibleReadingPlan, PlanSubscription } from '@/types'

interface PlanCardProps {
  plan: BibleReadingPlan
  subscription: PlanSubscription | null
}

export default function PlanCard({ plan, subscription }: PlanCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSubscribed = subscription !== null

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/plans/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, startDate: today }),
      })
      if (!res.ok) throw new Error('구독에 실패했습니다')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleUnsubscribe() {
    if (!subscription) return
    if (!confirm('정말 이 플랜을 해지하시겠습니까?')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plans/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      })
      if (!res.ok) throw new Error('해지에 실패했습니다')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-testid="plan-card"
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">{plan.name}</h2>
            {isSubscribed && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                구독 중
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
        </div>
        <div className="shrink-0">
          {isSubscribed ? (
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={loading}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              data-testid="unsubscribe-button"
            >
              {loading ? '처리 중...' : '해지하기'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              data-testid="subscribe-button"
            >
              {loading ? '처리 중...' : '구독하기'}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
