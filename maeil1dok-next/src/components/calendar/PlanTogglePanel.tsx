export interface TogglePlanItem {
  subscriptionId: string
  planName: string
  color: string
}

interface PlanTogglePanelProps {
  plans: TogglePlanItem[]
  visiblePlanIds: Set<string>
  onToggle: (subscriptionId: string) => void
}

export default function PlanTogglePanel({ plans, visiblePlanIds, onToggle }: PlanTogglePanelProps) {
  return (
    <section data-testid="plan-toggle-panel" className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-4 shadow-sm">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">표시할 플랜</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {plans.map((plan) => {
          const isVisible = visiblePlanIds.has(plan.subscriptionId)

          return (
            <button
              key={plan.subscriptionId}
              type="button"
              onClick={() => onToggle(plan.subscriptionId)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                isVisible
                  ? 'border-[var(--color-border-dark)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]'
                  : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
              <span>{plan.planName}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
