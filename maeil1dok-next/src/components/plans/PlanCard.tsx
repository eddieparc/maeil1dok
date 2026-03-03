'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BibleReadingPlan, PlanSubscription } from '@/types'

/* ──────────────────────────────────────────────────────────
 * SubscribedPlanCard — card for plans the user already follows
 * ────────────────────────────────────────────────────────── */

interface SubscribedPlanCardProps {
  plan: BibleReadingPlan
  subscription: PlanSubscription
}

export function SubscribedPlanCard({ plan, subscription }: SubscribedPlanCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHidden = !subscription.isActive

  function formatDate(dateString: string): string {
    const d = new Date(dateString)
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  async function handleToggleHide() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/plans/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
      })
      if (!res.ok) throw new Error('처리에 실패했습니다')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function handleGoToReading() {
    router.push(`/reading?plan=${subscription.planId}`)
  }

  return (
    <div
      className={`
        relative rounded-lg border overflow-hidden transition-all duration-200
        ${isHidden
          ? 'border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] opacity-60 dark:bg-[var(--color-bg-secondary)]'
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-dark)] hover:shadow-[var(--shadow-sm)] dark:bg-[var(--color-bg-secondary)]'
        }
      `}
      data-testid="plan-card"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Plan Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[0.9375rem] font-semibold text-[var(--color-text-primary)] leading-snug">
                {plan.name}
              </h3>
              {plan.isDefault && (
                <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] font-semibold rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] dark:bg-[var(--color-bg-tertiary)] dark:border-[var(--color-border-default)]">
                  기본 플랜
                </span>
              )}
              {isHidden && (
                <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] font-semibold rounded-md bg-[var(--color-text-muted)] text-white">
                  숨김
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              구독 시작일: {formatDate(subscription.startDate)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            {subscription.isActive && (
              <button
                onClick={handleGoToReading}
                disabled={loading}
                className="
                  px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]
                  border border-[var(--color-accent-primary)]
                  hover:opacity-90 active:opacity-80
                  transition-all duration-200 min-w-[72px] text-center
                  btn-interactive
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                성경통독표
              </button>
            )}
            {!plan.isDefault && (
              <button
                onClick={handleToggleHide}
                disabled={loading}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-lg
                  transition-all duration-200 min-w-[72px] text-center
                  btn-interactive
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${subscription.isActive
                    ? 'bg-[var(--color-button-default)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-hover)]'
                    : 'bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-hover)]'
                  }
                `}
              >
                {loading ? '처리 중…' : subscription.isActive ? '숨기기' : '다시 보기'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    </div>
  )
}


/* ──────────────────────────────────────────────────────────
 * AvailablePlanCard — card for plans the user can subscribe to
 * ────────────────────────────────────────────────────────── */

interface AvailablePlanCardProps {
  plan: BibleReadingPlan
  subscriberCount?: number
}

export function AvailablePlanCard({ plan, subscriberCount }: AvailablePlanCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div
      className="
        relative rounded-lg border border-[var(--color-border-default)]
        bg-[var(--color-bg-secondary)] overflow-hidden
        transition-all duration-200
        hover:border-[var(--color-border-dark)] hover:shadow-[var(--shadow-sm)]
        dark:bg-[var(--color-bg-secondary)]
      "
      data-testid="plan-card"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Plan Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[0.9375rem] font-semibold text-[var(--color-text-primary)] leading-snug">
                {plan.name}
              </h3>
              {plan.isDefault && (
                <span className="inline-flex items-center px-2 py-0.5 text-[0.65rem] font-semibold rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] dark:bg-[var(--color-bg-tertiary)] dark:border-[var(--color-border-default)]">
                  기본 플랜
                </span>
              )}
            </div>
            {plan.description && (
              <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] break-words leading-relaxed">
                {plan.description}
              </p>
            )}
            {subscriberCount !== undefined && (
              <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                구독한 사람: {subscriberCount}명
              </p>
            )}
          </div>

          {/* Subscribe button */}
          <div className="shrink-0">
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="
                px-4 py-1.5 text-xs font-medium rounded-lg
                bg-[var(--color-accent-primary)] text-white
                hover:bg-[var(--color-accent-hover)]
                active:opacity-80
                transition-all duration-200 min-w-[72px] text-center
                btn-interactive
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {loading ? '처리 중…' : '구독하기'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
        )}
      </div>
    </div>
  )
}


/* ──────────────────────────────────────────────────────────
 * Legacy default export — kept for backwards-compatibility
 * if anything still imports `import PlanCard from ...`
 * ────────────────────────────────────────────────────────── */

interface PlanCardProps {
  plan: BibleReadingPlan
  subscription: PlanSubscription | null
}

export default function PlanCard({ plan, subscription }: PlanCardProps) {
  if (subscription) {
    return <SubscribedPlanCard plan={plan} subscription={subscription} />
  }
  return <AvailablePlanCard plan={plan} />
}
