export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import PlanCard from '@/components/plans/PlanCard'
import type { PlanSubscription } from '@/types'

export default async function PlansPage() {
  try {
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const [availablePlans, subscriptions] = await Promise.all([
      repositories.plan.getAvailablePlans(),
      repositories.plan.getUserSubscriptions(),
    ])

    // Map planId -> subscription (only active ones matter for display)
    const subscriptionMap = new Map<number, PlanSubscription>()
    for (const sub of subscriptions) {
      if (sub.isActive) subscriptionMap.set(sub.planId, sub)
    }

    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }} className="px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">플랜 관리</h1>
        <div className="flex flex-col gap-4">
          {availablePlans.filter(p => p.isActive).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              subscription={subscriptionMap.get(plan.id) ?? null}
            />
          ))}
        </div>
        {availablePlans.filter(p => p.isActive).length === 0 && (
          <p className="text-center text-sm text-gray-500">이용 가능한 플랜이 없습니다</p>
        )}
      </main>
    )
  } catch {
    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-red-600">플랜 목록을 불러오는 중 오류가 발생했습니다</p>
        </div>
      </main>
    )
  }
}
