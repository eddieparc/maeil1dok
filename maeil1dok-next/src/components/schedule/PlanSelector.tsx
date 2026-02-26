'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { PlanSubscription, BibleReadingPlan } from '@/types'

interface PlanSelectorProps {
  subscriptions: PlanSubscription[]
  plans: BibleReadingPlan[]
  selectedSubscriptionId: string
}

export default function PlanSelector({ subscriptions, plans, selectedSubscriptionId }: PlanSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // If only 1 subscription, just show the plan name
  if (subscriptions.length <= 1) {
    const plan = plans.find((p) => p.id === subscriptions[0]?.planId)
    if (!plan) return null
    return (
      <div data-testid="plan-selector" className="mb-4 px-1">
        <h2 className="text-base font-semibold text-gray-800">{plan.name}</h2>
      </div>
    )
  }

  const planMap = new Map(plans.map((p) => [p.id, p]))

  function handleChange(subscriptionId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('planId', subscriptionId)
    router.push(`/plan?${params.toString()}`)
  }

  return (
    <div data-testid="plan-selector" className="mb-4 flex gap-2 overflow-x-auto px-1">
      {subscriptions.map((sub) => {
        const plan = planMap.get(sub.planId)
        const isSelected = sub.id === selectedSubscriptionId
        return (
          <button
            key={sub.id}
            onClick={() => handleChange(sub.id)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              isSelected
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 shadow-sm hover:bg-gray-50'
            }`}
          >
            {plan?.name ?? '플랜'}
          </button>
        )
      })}
    </div>
  )
}
