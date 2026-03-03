'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BibleReadingPlan, PlanSubscription } from '@/types'
import { Card, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
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
    <Card variant="default" className="w-full" data-testid="plan-card">
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{plan.name}</h2>
              {isSubscribed && (
                <Badge variant="primary" size="sm">
                  구독 중
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{plan.description}</p>
          </div>
          <div className="shrink-0">
            {isSubscribed ? (
              <Button
                type="button"
                variant="danger"
                onClick={handleUnsubscribe}
                loading={loading}
                className="w-full sm:w-auto"
                data-testid="unsubscribe-button"
              >
                해지하기
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={handleSubscribe}
                loading={loading}
                className="w-full sm:w-auto"
                data-testid="subscribe-button"
              >
                구독하기
              </Button>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>}
      </CardBody>
    </Card>
  )
}
