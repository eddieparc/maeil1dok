export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import PlanCard from '@/components/plans/PlanCard'
import type { PlanSubscription } from '@/types'
import Container from '@/components/ui/Container'
import PageHeader from '@/components/ui/PageHeader'

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
      <Container fullHeight className="pb-6">
        <PageHeader title="플랜 관리" />
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
          <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">이용 가능한 플랜이 없습니다</p>
        )}
      </Container>
    )
  } catch {
    return (
      <Container fullHeight>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-[var(--color-danger)]">플랜 목록을 불러오는 중 오류가 발생했습니다</p>
        </div>
      </Container>
    )
  }
}
