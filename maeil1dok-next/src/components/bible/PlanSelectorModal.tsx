'use client'

import { useEffect, useState } from 'react'

interface Plan {
  id: number
  title: string
  description?: string
  total_days?: number
}

interface PlanSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlan: (planId: number) => void
  currentPlanId?: number | null
}

export default function PlanSelectorModal({ isOpen, onClose, onSelectPlan, currentPlanId }: PlanSelectorModalProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    fetch('/api/bible/schedules')
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: { data?: Plan[] }) => setPlans(json.data ?? []))
      .catch(() => setPlans([]))
      .finally(() => setIsLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 pb-8 pt-4 shadow-[0_-16px_40px_-20px_rgba(0,0,0,0.65)]">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[var(--color-border-default)]" />
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50/80">Tongdok Entry</p>
          <h3 className="mt-1 text-lg font-extrabold">통독 플랜을 선택하세요</h3>
          <p className="mt-1 text-sm text-emerald-50/90">선택한 플랜의 오늘 분량으로 바로 이동해요</p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)]">사용 가능한 플랜 {plans.length}개</p>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)]"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <title>닫기</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {['loading-1', 'loading-2', 'loading-3'].map((loadingKey) => (
              <div key={loadingKey} className="h-20 animate-pulse rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-primary)] py-10 text-center text-sm text-[var(--color-text-secondary)]">
            사용 가능한 플랜이 없어요
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {plans.map((plan) => {
              const isSelected = currentPlanId === plan.id
              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`group relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                      : 'border-[var(--color-border-default)] bg-[var(--color-bg-primary)] hover:border-emerald-300/70 hover:bg-[var(--color-bg-tertiary)] dark:hover:border-emerald-500/40'
                  }`}
                  onClick={() => {
                    onSelectPlan(plan.id)
                    onClose()
                  }}
                >
                  {isSelected ? <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-600" /> : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-200' : 'text-[var(--color-text-primary)]'}`}>
                        {plan.title}
                      </p>
                      {plan.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-secondary)]">{plan.description}</p>
                      ) : null}
                      {plan.total_days ? (
                        <span className="mt-2 inline-flex rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {plan.total_days}일 플랜
                        </span>
                      ) : null}
                    </div>

                    <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[var(--color-border-default)] text-transparent group-hover:border-emerald-300'}`}>
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <title>선택됨</title>
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
