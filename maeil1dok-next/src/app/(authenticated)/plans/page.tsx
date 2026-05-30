export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { SubscribedPlanCard, AvailablePlanCard } from '@/components/plans/PlanCard'
import type { BibleReadingPlan, PlanSubscription } from '@/types'
import Container from '@/components/ui/Container'
import PageHeader from '@/components/ui/PageHeader'

export default async function PlansPage() {
  try {
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const [allPlans, subscriptions] = await Promise.all([
      repositories.plan.getAvailablePlans(),
      repositories.plan.getUserSubscriptions(),
    ])

    // Build lookup: planId → subscription
    const subscriptionMap = new Map<number, PlanSubscription>()
    for (const sub of subscriptions) {
      subscriptionMap.set(sub.planId, sub)
    }

    // Plans the user has subscribed to (active or hidden)
    const subscribedPlans: { plan: BibleReadingPlan; subscription: PlanSubscription }[] = []
    // Plans the user has NOT subscribed to
    const availablePlans: BibleReadingPlan[] = []

    for (const plan of allPlans.filter(p => p.isActive)) {
      const sub = subscriptionMap.get(plan.id)
      if (sub) {
        subscribedPlans.push({ plan, subscription: sub })
      } else {
        availablePlans.push(plan)
      }
    }

    return (
      <Container fullHeight className="pb-6">
        <PageHeader title="플랜 관리" />

        <div className="fade-in">
          {/* ── 구독 중인 플랜 ── */}
          <section className="mb-8">
            <h2
              className="mb-4 flex items-baseline gap-2 text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
              style={{
                fontFamily: 'var(--font-family-serif)',
                fontSize: '1.25rem',
                fontWeight: 500,
              }}
            >
              구독 중인 플랜
              {subscribedPlans.length > 0 && (
                <span
                  className="text-[12px] font-medium text-[var(--color-mute)] -tracking-[0.005em] tabular-nums"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  {subscribedPlans.length}개
                </span>
              )}
            </h2>

            {subscribedPlans.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-8 text-center">
                <p
                  className="text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  아직 구독 중인 플랜이 없습니다
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {subscribedPlans.map(({ plan, subscription }) => (
                  <SubscribedPlanCard
                    key={subscription.id}
                    plan={plan}
                    subscription={subscription}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── 이용 가능한 플랜 ── */}
          <section className="mb-8">
            <h2
              className="mb-4 flex items-baseline gap-2 text-[var(--color-ink)] -tracking-[0.025em] leading-[1.3]"
              style={{
                fontFamily: 'var(--font-family-serif)',
                fontSize: '1.25rem',
                fontWeight: 500,
              }}
            >
              이용 가능한 플랜
              {availablePlans.length > 0 && (
                <span
                  className="text-[12px] font-medium text-[var(--color-mute)] -tracking-[0.005em] tabular-nums"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  {availablePlans.length}개
                </span>
              )}
            </h2>

            {availablePlans.length === 0 ? (
              <div className="rounded-2xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-5 py-8 text-center">
                <p
                  className="text-[13px] font-medium text-[var(--color-mute)] -tracking-[0.008em]"
                  style={{ fontFamily: 'var(--font-family-ui)' }}
                >
                  현재 이용 가능한 플랜이 없습니다
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {availablePlans.map((plan) => (
                  <AvailablePlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </section>
        </div>
      </Container>
    )
  } catch {
    return (
      <Container fullHeight>
        <PageHeader title="플랜 관리" />
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-[var(--color-danger)]">
            플랜 목록을 불러오는 중 오류가 발생했습니다
          </p>
        </div>
      </Container>
    )
  }
}
